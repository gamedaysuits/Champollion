/* nmt-forge training panel — no dependencies, no network beyond this panel's own server.
   Reads /hud.json (labelled fields, units, help, health) and /status (the curves); draws the
   health lamps with their trends, gauges and zoomable SVG charts at their real pixel size.
   Read-only except the one stop control. Text from the run (names, events) is always inserted
   as text, never as markup. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private window: fine */ } },
  };
  const int = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (n) => String(n).replace(/./g, (c) => SUP[c] || c);
  const sci = (x) => {
    if (!isNum(x)) return '—';
    if (x === 0) return '0';
    const [m, e] = x.toExponential(1).split('e');
    return `${m} × 10${sup(parseInt(e, 10))}`;
  };
  // ONE way to write each kind of number — the same rules as the server's `display` strings,
  // so a chart label, a tile and a tooltip never disagree about the same value.
  const FMT = {
    chrf: (v) => (isNum(v) ? v.toFixed(1) : '—'),
    loss: (v) => (isNum(v) ? v.toFixed(2) : '—'),
    norm: (v) => (isNum(v) ? v.toFixed(2) : '—'),
    sps: (v) => (isNum(v) ? (v >= 1 ? v.toFixed(1) : v.toFixed(2)) : '—'),
    gb: (v) => (isNum(v) ? v.toFixed(1) : '—'),
    sci,
  };

  const ST = {
    raw: null, hud: null, help: {}, v: -1, hudAt: 0, view: 'run',
    xmode: store.get('nmtf-x') === 'pass' ? 'pass' : 'step',
    smooth: isNum(parseFloat(store.get('nmtf-smooth'))) ? parseFloat(store.get('nmtf-smooth')) : 0.6,
    logscale: store.get('nmtf-log') !== 'off',
    zoom: null, hoverStep: null, hoverChart: null, hoverXY: null,
    runs: null, runsAt: 0, runsHL: null, runsPin: null, online: true, said: {},
  };
  const F = () => (ST.hud && ST.hud.fields) || {};
  const val = (k) => (F()[k] ? F()[k].value : null);

  // ---------------------------------------------------------------- theme ----
  const THEMES = ['auto', 'light', 'dark'];
  let theme = THEMES.includes(store.get('nmtf-theme')) ? store.get('nmtf-theme') : 'auto';
  function applyTheme() {
    const r = document.documentElement;
    if (theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', theme);
    const b = $('#themebtn');
    const name = theme === 'auto' ? 'automatic (follows this computer)' : theme;
    b.setAttribute('aria-label', `Colour theme: ${name}`);
    b.title = `Theme: ${name}`;
  }
  applyTheme();
  $('#themebtn').addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    store.set('nmtf-theme', theme);
    applyTheme();
    redrawAll();
  });

  // -------------------------------------------------------------- tooltips ----
  // Explanations live in tooltips: hover or keyboard focus on a computer, a tap on a phone.
  // Each opens with the value itself (with its unit), then what it is, why it matters, how to read it.
  const tip = $('#tip');
  let tipEl = null, tipTimer = 0, lastTouch = 0;
  function fieldsIn(el) {
    const names = $$('[data-field]', el).map((e) => e.dataset.field);
    if (el.dataset.field) names.unshift(el.dataset.field);
    return [...new Set(names)];
  }
  function valueOf(el) {
    const head = el.matches('[data-field]') ? el : (el.querySelector('b[data-field], b') || el.querySelector('[data-field]'));
    if (!head) return '';
    const txt = head.textContent.trim();
    if (!txt || txt === '—') return '';
    const f = head.dataset.field && F()[head.dataset.field];
    const unit = f && f.unit && !/[a-zA-Z%$]/.test(txt.replace(/[\d.,\s+−-]/g, '')) ? ` ${f.unit}` : '';
    return txt.length > 60 ? '' : `${txt}${unit}`;
  }
  function showTip(el) {
    const h = ST.help[el.dataset.help];
    if (!h) return;
    tip.replaceChildren();
    const t = document.createElement('div'); t.className = 't';
    const tt = document.createElement('span'); tt.textContent = h.title;
    t.append(tt);
    const v = valueOf(el);
    if (v && v !== h.title) { const vv = document.createElement('span'); vv.className = 'v'; vv.textContent = v; t.append(vv); }
    tip.append(t);
    for (const [label, key] of [['What it is', 'what'], ['Why it matters', 'why'], ['How to read it', 'read']]) {
      if (!h[key]) continue;
      const p = document.createElement('p');
      const em = document.createElement('em'); em.textContent = label;
      p.append(em, document.createTextNode(h[key]));
      tip.append(p);
    }
    const names = fieldsIn(el);
    if (names.length) {
      const f = document.createElement('div'); f.className = 'f';
      f.textContent = `fields: ${names.join(' · ')}`;
      tip.append(f);
    }
    tip.hidden = false;
    const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const left = clamp(r.left + r.width / 2 - tw / 2, 12, vw - tw - 12);
    let top = r.bottom + 8;
    if (top + th > vh - 8 && r.top - th - 8 > 8) top = r.top - th - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${clamp(top, 8, Math.max(8, vh - th - 8))}px`;
    tipEl = el;
    el.setAttribute('aria-describedby', 'tip');
  }
  function hideTip() {
    clearTimeout(tipTimer);
    if (tipEl) tipEl.removeAttribute('aria-describedby');
    tipEl = null;
    tip.hidden = true;
  }
  document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') lastTouch = Date.now(); }, true);
  document.addEventListener('mouseover', (e) => {
    if (Date.now() - lastTouch < 900) return;
    const el = e.target.closest('[data-help]');
    if (!el || el === tipEl) return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => showTip(el), 260);
  });
  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest('[data-help]');
    if (!el) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    clearTimeout(tipTimer);
    if (tipEl === el) hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest && e.target.closest('[data-help]');
    if (el && Date.now() - lastTouch > 900) showTip(el);
  });
  document.addEventListener('focusout', () => hideTip());
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-help]');
    if (Date.now() - lastTouch < 900) {           // a tap: toggle that tooltip
      if (el && el !== tipEl && !e.target.closest('button,input,a')) { showTip(el); return; }
      if (el === tipEl) { hideTip(); return; }
    }
    if (!el) hideTip();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideTip(); hideConfirm(); } });
  window.addEventListener('scroll', () => { if (tipEl) hideTip(); }, { passive: true });
  function makeFocusable() {
    for (const el of $$('[data-help]')) {
      if (!el.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|LABEL|TR)$/.test(el.tagName)) el.tabIndex = 0;
    }
  }

  // ------------------------------------------------------- labelled fields ----
  function renderFields() {
    const FF = F();
    for (const el of $$('[data-field]')) {
      const f = FF[el.dataset.field];
      if (!f) continue;
      const known = f.value !== null && f.value !== undefined;
      const disp = !known && el.dataset.unknown ? el.dataset.unknown : (f.display == null ? '—' : String(f.display));
      if (el.textContent !== disp) el.textContent = disp;
      el.dataset.value = known ? (typeof f.value === 'object' ? JSON.stringify(f.value) : String(f.value)) : '';
      if (f.unit) el.dataset.unit = f.unit;
      el.dataset.known = known ? 'true' : 'false';
    }
    const isKnown = (k) => !!FF[k] && FF[k].value !== null && FF[k].value !== undefined;
    for (const el of $$('[data-only]')) {
      el.hidden = !isKnown(el.dataset.only) || (el.dataset.unless || '').split(' ').some((k) => k && isKnown(k));
    }
    for (const el of $$('[data-label]')) {
      const f = FF[el.dataset.label];
      if (f && f.label && el.textContent !== f.label) el.textContent = f.label;
    }
    for (const lamp of $$('[data-lamp]')) lamp.dataset.state = val(`health_${lamp.dataset.lamp}`) || '';
    const ch = val('dev_score_change');
    const d = $('.delta');
    if (d) d.dataset.sign = isNum(ch) ? (ch > 0 ? 'up' : ch < 0 ? 'down' : '') : '';
    const title = val('run_label') || val('run_name') || 'Training run';
    $('#title').textContent = title;
    $('#title').title = title;
    const status = val('run_status') || 'starting';
    $('.pill.status').dataset.state = ST.online ? status : 'stopped';
    if (!ST.online) $('[data-field="run_status"]').textContent = 'panel unreachable';
    $('.pill.where').dataset.state = val('sovereignty') || 'sovereign';
    $('.verdict').dataset.state = val('verdict') || '';
    const best = val('dev_score_best');
    document.title = `${isNum(best) ? `${best.toFixed(1)} chrF++ · ` : ''}${status} · ${title} — nmt-forge`;
    $('.confirm .nopid').hidden = !!(ST.hud && ST.hud.stop_available);
    const useFinal = !isNum(best) && isNum(val('final_dev_score'));
    $('#ring-best').hidden = useFinal;
    $('#ring-final').hidden = !useFinal;
  }

  // What a screen reader hears: a new best, a health reading turning to alert, the run ending.
  function announce() {
    const said = ST.said, out = [];
    const best = val('dev_score_best'), step = val('dev_score_best_step');
    if (isNum(best) && said.best !== undefined && best !== said.best) out.push(`New best dev score ${best.toFixed(1)} chrF++ at step ${int(step)}.`);
    said.best = best;
    const status = val('run_status');
    if (said.status && status !== said.status) out.push(`Training ${status}.`);
    said.status = status;
    for (const h of (ST.hud && ST.hud.health) || []) {
      const k = `h_${h.key}`;
      if (h.state === 'alert' && said[k] && said[k] !== 'alert') out.push(`${h.label}: ${h.text}.`);
      said[k] = h.state || 'none';
    }
    if (out.length) $('#announce').textContent = out.join(' ');
  }

  // ---------------------------------------------------------------- gauges ----
  const polar = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  function arc(cx, cy, r, a0, a1) {
    const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  function drawScoreGauge() {
    const cx = 100, cy = 92, r = 74, A0 = 135, SW = 270;
    const ang = (v) => A0 + (SW * clamp(v, 0, 100)) / 100;
    let s = `<path d="${arc(cx, cy, r, A0, A0 + SW)}" style="fill:none;stroke:var(--surface-3);stroke-width:13;stroke-linecap:round"/>`;
    const best = isNum(val('dev_score_best')) ? val('dev_score_best') : val('final_dev_score');
    const latest = val('dev_score_latest'), floor = val('dictionary_floor');
    const ci = val('dictionary_floor_ci'), fci = val('final_dev_score_ci');
    if (Array.isArray(ci) && isNum(ci[0]) && isNum(ci[1])) {
      s += `<path d="${arc(cx, cy, r + 11, ang(ci[0]), Math.max(ang(ci[1]), ang(ci[0]) + 0.8))}" style="fill:none;stroke:var(--ref);stroke-width:3;opacity:.5"/>`;
    }
    if (isNum(best) && best > 0) {
      s += `<path d="${arc(cx, cy, r, A0, Math.max(ang(best), A0 + 0.5))}" style="fill:none;stroke:var(--dev);stroke-width:13;stroke-linecap:round"/>`;
    }
    if (Array.isArray(fci) && isNum(fci[0]) && isNum(fci[1])) {          // the final score's 95% range, outside the ring
      s += `<path d="${arc(cx, cy, r + 11, ang(fci[0]), Math.max(ang(fci[1]), ang(fci[0]) + 0.8))}" style="fill:none;stroke:var(--final);stroke-width:3;stroke-linecap:round"/>`;
    }
    // every check as a tick inside the ring: where the score has been
    for (const c of (ST.hud && ST.hud.checks) || []) {
      if (!isNum(c.dev_score)) continue;
      const [ax, ay] = polar(cx, cy, r - 9, ang(c.dev_score)), [bx, by] = polar(cx, cy, r - 14, ang(c.dev_score));
      s += `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" style="stroke:var(--deco);stroke-width:1.2"/>`;
    }
    if (isNum(floor)) {
      const [ax, ay] = polar(cx, cy, r - 10, ang(floor)), [bx, by] = polar(cx, cy, r + 13, ang(floor));
      s += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" style="stroke:var(--ink);stroke-width:2"/>`;
    }
    if (isNum(latest) && latest !== best) {
      const [lx, ly] = polar(cx, cy, r, ang(latest));
      s += `<circle cx="${lx}" cy="${ly}" r="5" style="fill:var(--surface);stroke:var(--dev);stroke-width:2.5"/>`;
    }
    for (const [v, anchor] of [[0, 'end'], [100, 'start']]) {
      const [tx, ty] = polar(cx, cy, r + 4, ang(v));
      s += `<text x="${tx + (v ? 6 : -6)}" y="${ty + 14}" text-anchor="${anchor}" style="font:11px var(--font-ui);fill:var(--muted)">${v}</text>`;
    }
    $('#g-score').innerHTML = s;
  }
  function drawSteps() {
    const pct = isNum(val('progress_pct')) ? val('progress_pct') : 0;
    const cx = 32, cy = 32, r = 26;
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:none;stroke:var(--surface-3);stroke-width:7"/>`;
    if (pct > 0) {
      s += pct >= 99.95
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:none;stroke:var(--ink-2);stroke-width:7"/>`
        : `<path d="${arc(cx, cy, r, -90, -90 + 3.6 * pct)}" style="fill:none;stroke:var(--ink-2);stroke-width:7;stroke-linecap:round"/>`;
    }
    s += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" style="font:600 12px var(--font-ui);fill:var(--ink)">${Math.round(pct)}%</text>`;
    $('#g-steps').innerHTML = s;
  }
  function drawMeters() {
    const H = ST.hud || {};
    // checks: one cell per planned check; the best in teal; the patience stop outlined
    const checks = H.checks || [];
    const planned = val('checks_planned');
    const n = clamp(isNum(planned) && planned >= checks.length ? planned : checks.length + 1, 1, 80);
    const bestN = (checks.find((c) => c.best) || {}).n;
    const every = val('check_every_steps'), stopAt = val('stop_by_patience_step');
    const stopN = isNum(stopAt) && isNum(every) && every > 0 ? Math.round(stopAt / every) : null;
    const cells = $('#checkcells');
    cells.replaceChildren(...Array.from({ length: n }, (_, i) => {
      const el = document.createElement('i');
      if (i < checks.length) el.className = i + 1 === bestN ? 'best' : 'done';
      else if (stopN && i + 1 === stopN) el.className = 'pstop';
      return el;
    }));
    // patience pips
    const lim = val('patience_limit'), used = val('patience_used');
    $('#pips').replaceChildren(...(isNum(lim) ? Array.from({ length: clamp(lim, 0, 24) }, (_, i) => {
      const el = document.createElement('i');
      if (isNum(used) && i < used) el.className = 'used';
      return el;
    }) : []));
    // memory bar: now, the highest so far, and the 80% line where the health reading turns to watch
    const mem = val('memory_used_gb'), limit = val('memory_limit_gb'), peak = val('memory_peak_gb');
    const mb = $('#membar');
    mb.querySelector('i').style.width = isNum(mem) && isNum(limit) ? `${clamp((100 * mem) / limit, 0, 100)}%` : '0';
    const pk = mb.querySelector('s');
    pk.style.display = isNum(peak) && isNum(limit) ? 'block' : 'none';
    if (isNum(peak) && isNum(limit)) pk.style.left = `calc(${clamp((100 * peak) / limit, 0, 100)}% - 1px)`;
    mb.querySelector('u').style.display = isNum(limit) ? 'block' : 'none';
    mb.classList.toggle('high', isNum(mem) && isNum(limit) && mem / limit > 0.85);
    const usd = val('cost_usd'), cap = val('cost_cap_usd');
    const cb = $('#costbar');
    cb.querySelector('i').style.width = isNum(usd) && isNum(cap) && cap > 0 ? `${clamp((100 * usd) / cap, 0, 100)}%` : '0';
    cb.classList.toggle('high', isNum(usd) && isNum(cap) && usd / cap > 0.9);
  }

  // ------------------------------------------------- health lamps' sparklines ----
  function bucket(pts, n) {                 // mean per bucket: a trend, not every wiggle
    if (pts.length <= n) return pts;
    const out = [], size = pts.length / n;
    for (let i = 0; i < n; i++) {
      const part = pts.slice(Math.floor(i * size), Math.floor((i + 1) * size));
      if (!part.length) continue;
      out.push([part[part.length - 1][0], part.reduce((a, p) => a + p[1], 0) / part.length]);
    }
    return out;
  }
  function sparkSeries(key) {
    const H = ST.hud || {};
    if (key === 'score') {
      const m = H.checks_measure || 'dev_score';
      return { pts: (H.checks || []).filter((c) => isNum(c[m])).map((c) => [c.step, c[m]]), dots: true };
    }
    if (key === 'learning') return { pts: bucket(ema(pointsOf('train_loss'), 0.9), 48), log: true };
    if (key === 'overfit') return { pts: pointsOf('dev_loss'), dots: true };
    if (key === 'stability') return { pts: bucket(ema(seriesOf('grad_norm'), 0.8), 48), log: true };
    if (key === 'memory') {
      const lim = val('memory_limit_gb');
      return { pts: seriesOf('memory_gb'), lo: 0, hi: isNum(lim) ? lim : null };
    }
    if (key === 'freshness') {                // the wait so far against the usual wait (marks: 1×, 1.5× watch, 3× alert)
      const age = val('data_age_s'), exp = val('heartbeat_expected_s');
      return { bar: isNum(age) && isNum(exp) && exp > 0 ? clamp(age / (3 * exp), 0, 1) : null, marks: [1 / 3, 0.5] };
    }
    if (key === 'cost') {
      const usd = val('cost_usd'), cap = val('cost_cap_usd'), proj = val('cost_projected_usd');
      return { bar: isNum(usd) && isNum(cap) && cap > 0 ? clamp(usd / cap, 0, 1) : null, marks: [0.7],
        ghost: isNum(proj) && isNum(cap) && cap > 0 ? clamp(proj / cap, 0, 1) : null };
    }
    return { pts: [] };
  }
  function drawSparks() {
    for (const lamp of $$('[data-lamp]')) {
      const svg = lamp.querySelector('.spark');
      if (!svg || lamp.hidden) continue;
      const W = Math.round(svg.clientWidth) || 120, H = 22;
      const d = sparkSeries(lamp.dataset.lamp);
      const state = lamp.dataset.state;
      const tone = state === 'alert' ? 'var(--crit)' : state === 'watch' ? 'var(--warn)' : state === 'ok' ? 'var(--ok)' : 'var(--deco)';
      let s = '';
      if (d.bar !== undefined) {
        if (d.bar !== null) {
          s += `<rect x="0" y="8" width="${W}" height="6" rx="3" style="fill:var(--surface-3)"/>`;
          if (isNum(d.ghost)) s += `<rect x="0" y="8" width="${(W * d.ghost).toFixed(1)}" height="6" rx="3" style="fill:${tone};opacity:.25"/>`;
          s += `<rect x="0" y="8" width="${Math.max(3, W * d.bar).toFixed(1)}" height="6" rx="3" style="fill:${tone}"/>`;
          for (const mk of d.marks || []) s += `<line x1="${(W * mk).toFixed(1)}" x2="${(W * mk).toFixed(1)}" y1="5" y2="17" style="stroke:var(--muted);stroke-width:1;stroke-dasharray:2 2"/>`;
        } else {
          s += `<line x1="0" x2="${W}" y1="11" y2="11" style="stroke:var(--border);stroke-dasharray:2 3"/>`;
        }
      } else {
        const pts = (d.pts || []).filter((p) => isNum(p[1]) && (!d.log || p[1] > 0));
        if (pts.length >= 2) {
          const tf = d.log ? Math.log10 : (v) => v;
          const ys = pts.map((p) => tf(p[1]));
          let lo = isNum(d.lo) ? tf(Math.max(d.lo, d.log ? 1e-12 : d.lo)) : Math.min(...ys);
          let hi = isNum(d.hi) ? tf(d.hi) : Math.max(...ys);
          if (!isNum(d.lo) && !isNum(d.hi)) { const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.1 || 1; lo -= pad; hi += pad; }
          if (!(hi > lo)) hi = lo + 1;
          const x0 = pts[0][0], x1 = pts[pts.length - 1][0] || 1;
          const X = (x) => 2 + ((x - x0) / ((x1 - x0) || 1)) * (W - 6);
          const Y = (v) => 2 + (1 - (tf(v) - lo) / (hi - lo)) * (H - 4);
          const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('');
          s += `<path class="sl" d="${path}"/>`;
          if (d.dots && pts.length <= 40) for (const p of pts) s += `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="1.6" style="fill:var(--ink-2);opacity:.6"/>`;
          const last = pts[pts.length - 1];
          s += `<circle class="se" cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="3" style="fill:${tone}"/>`;
        } else {
          s += `<line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" style="stroke:var(--border);stroke-dasharray:2 3"/>`;
        }
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = s;
    }
  }

  // ------------------------------------------- settings, checks, checkpoints ----
  const SETTING_ROWS = [
    ['effective_batch', 'Pairs per step', (v, s) => (s.batch_size && s.grad_accum ? `${v} (${s.batch_size} × ${s.grad_accum})` : String(v))],
    ['lr', 'Peak learning rate', sci],
    ['warmup_ratio', 'Warm-up', (v) => `${Math.round(v * 100)}% of the steps`],
    ['weight_decay', 'Weight decay', (v) => String(v)],
    ['eval_steps', 'A check every', (v) => `${int(v)} steps`],
    ['patience', 'Patience', (v) => `${v} checks`],
    ['floor_steps', 'Earliest stop', (v) => `step ${int(v)}`],
    ['max_tgt', 'Length limit', (v, s) => `${s.max_src ? `${int(s.max_src)} → ` : ''}${int(v)} tokens`],
    ['optim', 'Optimizer', (v) => String(v)],
    ['gradient_checkpointing', 'Memory saving', (v) => (v ? 'on (recomputes, slower)' : 'off')],
    ['lora_rank', 'Adapter rank', (v) => String(v)],
    ['label_smoothing', 'Label smoothing', (v) => String(v)],
    ['mps_memory_fraction', 'Graphics memory cap', (v) => `${v} × recommended`],
    ['time_budget_hours', 'Time budget', (v) => `${v} h`],
    ['selection_metric', 'Keeps the best by', (v) => (String(v).includes('chrf') ? 'dev score (chrF++)' : String(v))],
    ['seed', 'Seed', (v) => String(v)],
    ['device', 'Device', (v) => String(v)],
  ];
  function renderSettings() {
    const s = (ST.hud && ST.hud.settings) || {};
    const dl = $('#settings');
    const rows = [];
    for (const [key, label, fmt] of SETTING_ROWS) {
      if (s[key] === undefined || s[key] === null) continue;
      const div = document.createElement('div'); div.dataset.help = 'settings';
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd');
      dd.dataset.field = `settings.${key}`;
      dd.dataset.value = String(s[key]);
      dd.textContent = fmt(s[key], s);
      div.append(dt, dd);
      rows.push(div);
    }
    if (!rows.length) {
      const div = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = 'Settings';
      const dd = document.createElement('dd'); dd.textContent = 'not recorded for this run';
      div.append(dt, dd); rows.push(div);
    }
    const key = JSON.stringify(s);
    if (dl.dataset.key !== key) { dl.replaceChildren(...rows); dl.dataset.key = key; makeFocusable(); }
  }
  // The checks as a table, newest first: the score with a bar, the change, the dev loss, and whether
  // that check's checkpoint is still on disk. Pointing at a row marks its step on every chart.
  function renderChecks() {
    const H = ST.hud || {};
    const checks = H.checks || [];
    const tb = $('#checktable tbody');
    const saved = new Set((H.checkpoints || []).map((c) => c.step));
    const kept = val('kept_checkpoint');
    const key = JSON.stringify([checks, [...saved], kept]);
    if (tb.dataset.key === key) return;
    tb.dataset.key = key;
    if (!checks.length) {
      const tr = document.createElement('tr'); tr.className = 'empty';
      const td = document.createElement('td'); td.colSpan = 6;
      td.textContent = ST.raw && ST.raw.scored === false ? 'this run keeps the checkpoint with the lowest dev loss' : 'no check yet';
      tr.append(td); tb.replaceChildren(tr);
      return;
    }
    const byScore = H.checks_measure !== 'dev_loss';
    const top = Math.max(...checks.map((c) => (byScore ? c.dev_score : c.dev_loss)).filter(isNum), 1e-9);
    const rows = checks.map((c, i) => {
      const tr = document.createElement('tr');
      tr.dataset.help = 'check_at_step';
      tr.dataset.field = 'check';
      tr.dataset.step = c.step;
      const mv = byScore ? c.dev_score : c.dev_loss;
      tr.dataset.value = isNum(mv) ? mv : '';
      tr.dataset.unit = byScore ? 'chrF++' : 'loss';
      tr.className = `${c.best ? 'best ' : ''}${c.new_best ? 'nb' : ''}`;
      const td = (cls, text) => { const x = document.createElement('td'); if (cls) x.className = cls; if (text !== undefined) x.textContent = text; return x; };
      const sc = td('sc');
      const bar = document.createElement('div'); bar.className = 'sbar';
      const b = document.createElement('b'); b.textContent = byScore ? FMT.chrf(c.dev_score) : FMT.loss(c.dev_loss);
      const track = document.createElement('i'); const fill = document.createElement('s');
      fill.style.width = isNum(mv) ? `${clamp((100 * mv) / top, 0, 100)}%` : '0';
      track.append(fill); bar.append(b, track); sc.append(bar);
      const prev = checks[i - 1];
      const pv = prev ? (byScore ? prev.dev_score : prev.dev_loss) : null;
      const delta = isNum(mv) && isNum(pv) ? mv - pv : null;
      const better = delta !== null && (byScore ? delta > 0 : delta < 0);
      const chg = td(`n ch${delta === null || delta === 0 ? '' : better ? ' up' : ' down'}`,
        delta === null ? '—' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta).toFixed(byScore ? 1 : 2)}`);
      const name = `checkpoint-${c.step}`;
      const sv = td('sv');
      if (kept === name) { const k = document.createElement('i'); k.className = 'lk final solid'; sv.append(k, document.createTextNode('kept')); }
      else if (saved.has(c.step)) { const k = document.createElement('i'); k.className = 'lk sq'; sv.append(k, document.createTextNode('on disk')); }
      tr.append(td('n', String(c.n)), td('n', int(c.step)), sc, chg, td('n', FMT.loss(c.dev_loss)), sv);
      tr.addEventListener('mouseenter', () => setHover(null, c.step));
      tr.addEventListener('mouseleave', () => clearHover());
      return tr;
    }).reverse();
    tb.replaceChildren(...rows);
  }
  function renderCheckpoints() {
    const H = ST.hud || {};
    const best = val('best_checkpoint'), kept = val('kept_checkpoint');
    const items = (H.checkpoints || []).slice().sort((a, b) => a.step - b.step);
    $('#ckpts').replaceChildren(...items.map((c) => {
      const li = document.createElement('li');
      li.dataset.field = 'checkpoint';
      li.dataset.value = c.name;
      li.className = c.name === kept ? 'kept' : (c.name === best ? 'best' : '');
      li.textContent = `${c.name}${isNum(c.bytes) ? ` · ${FMT.gb(c.bytes / 1073741824)} GB` : ''}`;
      return li;
    }));
  }
  function renderEvents() {
    const ev = (ST.raw && ST.raw.events) || [];
    const ol = $('#events');
    if (ol.dataset.n === String(ev.length)) return;
    ol.dataset.n = String(ev.length);
    $('#evcount').textContent = `${ev.length} event${ev.length === 1 ? '' : 's'} · newest first`;
    ol.replaceChildren(...ev.slice(-200).reverse().map((e) => {
      const li = document.createElement('li');
      const t = document.createElement('time'); t.textContent = e.t || '';
      const sp = document.createElement('span'); sp.textContent = e.text || '';
      li.append(t, sp);
      return li;
    }));
  }

  // ------------------------------------------------------------ chart engine ----
  // Each chart: SVG drawn at the host's real pixel size (no stretching), round ticks,
  // drag-to-zoom on the step axis shared by every chart, double-click to reset, one
  // crosshair across all charts, a readout with units on the chart under the pointer.
  // Annotations: new-best dots filled / the rest hollow, the best-so-far step line, the
  // patience window, checkpoints on disk as a rug, the lowest dev loss, direct end labels.
  const CHARTS = {};
  const ctip = $('#ctip');

  function niceStep(span, n) {
    const raw = span / Math.max(1, n), mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
    return (f < 1.5 ? 1 : f < 2.25 ? 2 : f < 3.5 ? 2.5 : f < 7.5 ? 5 : 10) * mag;
  }
  function niceTicks(lo, hi, n) {
    if (!(hi > lo)) return [lo];
    const st = niceStep(hi - lo, n), out = [];
    for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + st * 1e-9; v += st) out.push(+v.toPrecision(12));
    return out;
  }
  function logTicks(llo, lhi) {
    const out = [];
    for (let e = Math.floor(llo); e <= Math.ceil(lhi); e++) {
      for (const m of [1, 2, 5]) { const v = m * 10 ** e, l = Math.log10(v); if (l >= llo - 1e-9 && l <= lhi + 1e-9) out.push(v); }
    }
    if (out.length > 7) return out.filter((v) => Math.abs(Math.log10(v) - Math.round(Math.log10(v))) < 1e-9);
    if (out.length < 3) return niceTicks(10 ** llo, 10 ** lhi, 3).filter((v) => v > 0);
    return out;
  }
  function tickLabel(v, step) {           // as many decimals as the tick step needs: 0, 1, 2 — not 0.0, 1.0, 2.0
    if (Math.abs(v) >= 1000) return int(v);
    const s = +Number(step).toPrecision(6);
    const dp = Number.isInteger(s) ? 0 : Math.min(4, (String(s).split('.')[1] || '').length);
    return v.toFixed(dp);
  }
  function ema(pts, w) {
    if (!(w > 0)) return pts;
    let last = 0, n = 0;
    const out = [];
    for (const [x, y] of pts) {
      if (!isNum(y)) continue;
      last = last * w + (1 - w) * y; n += 1;
      out.push([x, last / (1 - w ** n)]);
    }
    return out;
  }
  function visible(pts, x0, x1) {
    let a = 0, b = pts.length;
    while (a < pts.length && pts[a][0] < x0) a++;
    while (b > 0 && pts[b - 1][0] > x1) b--;
    return pts.slice(Math.max(0, a - 1), Math.min(pts.length, b + 1));
  }
  function downsample(pts, X, px) {          // min/max per pixel column keeps the spikes
    if (pts.length <= px * 2) return pts;
    const out = [];
    let col = null, lo = null, hi = null, first = null;
    const flush = () => { if (!first) return; const pair = [lo, hi].sort((p, q) => p[0] - q[0]); out.push(first); for (const p of pair) if (p !== first) out.push(p); };
    for (const p of pts) {
      const c = Math.round(X(p[0]));
      if (c !== col) { flush(); col = c; first = p; lo = p; hi = p; continue; }
      if (p[1] < lo[1]) lo = p;
      if (p[1] > hi[1]) hi = p;
    }
    flush();
    return out;
  }
  function nearest(pts, x) {
    if (!pts.length) return null;
    let a = 0, b = pts.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (pts[m][0] < x) a = m; else b = m; }
    return Math.abs(pts[a][0] - x) <= Math.abs(pts[b][0] - x) ? pts[a] : pts[b];
  }
  const COLORS = { dev: 'var(--dev)', train: 'var(--train)', ink: 'var(--ink-2)', ref: 'var(--ref)', final: 'var(--final)' };

  function stepsPerPass() {
    const sp = val('steps_planned'), ep = val('epochs_planned');
    return isNum(sp) && isNum(ep) && ep > 0 ? sp / ep : null;
  }
  function xmaxOf() {
    const s = ST.raw || {};
    let m = Math.max(s.planned_steps || 0, val('steps_planned') || 0);
    for (const p of s.points || []) m = Math.max(m, p.step);
    return m || 1;
  }
  const seriesOf = (key) => ((ST.raw && ST.raw.series && ST.raw.series[key]) || []).filter((p) => isNum(p[0]) && isNum(p[1]));
  const pointsOf = (key) => ((ST.raw && ST.raw.points) || []).filter((p) => isNum(p[key])).map((p) => [p.step, p[key]]);

  function chartData(id) {
    const d = chartData0(id), H = ST.hud || {};
    if (H.where && H.where.kind === 'remote' && H.where.ended === false && id !== 'c-runs') {
      d.empty = id === 'c-mem' ? 'not read on the rented machine'
        : H.where.progress ? 'arrives with the rented machine’s first checkpoint'
          : 'training on the rented machine — waiting for its first reading';
    }
    return d;
  }
  function chartData0(id) {
    const s = ST.raw || {}, H = ST.hud || {};
    const xmax = xmaxOf();
    const vlines = isNum(s.floor_steps) && s.floor_steps > 0 ? [{ x: s.floor_steps, label: 'earliest stop' }] : [];
    if (id === 'c-score') {
      const pts = pointsOf('dev_score');
      let bestP = null;
      for (const p of pts) if (!bestP || p[1] > bestP[1]) bestP = p;
      const nb = new Set((H.checks || []).filter((c) => c.new_best).map((c) => c.step));
      const fl = s.floor && isNum(s.floor.score) ? s.floor : null;
      const fin = (H.finalists || []).filter((f) => isNum(f.step) && isNum(f.chrf));
      const stopAt = val('stop_by_patience_step');
      const zones = isNum(stopAt) && bestP && isNum(val('stop_by_patience_in_s'))
        ? [{ x0: bestP[0], x1: stopAt, label: `patience stop · step ${int(stopAt)}`, sub: 'if no new best' }] : [];
      const kept = val('kept_checkpoint');
      const rug = (H.checkpoints || []).map((c) => ({ x: c.step, kind: c.name === kept ? 'kept' : 'saved', name: c.name }));
      // the bar to beat: the best score, from its check to where patience runs out (or the latest check)
      const lastX = pts.length ? pts[pts.length - 1][0] : null;
      const barEnd = zones.length ? zones[0].x1 : lastX;
      const bars = bestP && isNum(barEnd) && barEnd > bestP[0] ? [{ x0: bestP[0], x1: barEnd, y: bestP[1] }] : [];
      return {
        xmax, vlines, zones, rug, bars, min0: true, max100: true, unit: 'chrF++', fmt: FMT.chrf,
        series: [
          { name: 'dev score', color: COLORS.dev, pts, dots: true, dotFill: (p) => nb.has(p[0]), unit: 'chrF++', delta: true, label: 'value' },
        ],
        hlines: fl ? [{ y: fl.score, lo: Array.isArray(fl.ci) ? fl.ci[0] : null, hi: Array.isArray(fl.ci) ? fl.ci[1] : null, label: `dictionary floor ${fl.score.toFixed(1)}` }] : [],
        ring: bestP,
        err: fin.map((f) => ({ x: f.step, y: f.chrf, lo: f.ci ? f.ci[0] : null, hi: f.ci ? f.ci[1] : null, label: f.id, kept: f.id === kept })),
        empty: s.scored === false ? 'this run keeps the checkpoint with the lowest dev loss — no dev score' : 'waiting for the first check',
      };
    }
    if (id === 'c-loss') {
      const tr = pointsOf('train_loss'), dl = pointsOf('dev_loss');
      let low = null;
      for (const p of dl) if (!low || p[1] < low[1]) low = p;
      return {
        xmax, vlines, log: ST.logscale, min0: !ST.logscale, unit: 'loss', fmt: FMT.loss,
        series: [
          { name: 'train', color: COLORS.train, pts: ema(tr, ST.smooth), raw: ST.smooth > 0 ? tr : null, unit: '', smoothed: ST.smooth > 0, label: 'name' },
          { name: 'dev', color: COLORS.dev, pts: dl, dots: true, unit: '', label: 'name' },
        ],
        marks: low && dl.length >= 3 && low !== dl[dl.length - 1] ? [{ x: low[0], y: low[1], label: 'lowest dev loss' }] : [],
        empty: 'waiting for the first loss',
      };
    }
    if (id === 'c-lr') {
      const lr = seriesOf('lr');
      const st = H.settings || {};
      const plan = isNum(st.lr) && isNum(val('steps_planned'))
        ? (() => { const T = val('steps_planned'), W = Math.round((st.warmup_ratio || 0) * T); return W > 0 ? [[0, 0], [W, st.lr], [T, 0]] : [[0, st.lr], [T, 0]]; })()
        : [];
      return {
        xmax, vlines, min0: true, unit: 'per step', kind: 'sci', fmt: sci,
        series: [
          { name: 'learning rate', color: COLORS.ink, pts: lr, unit: '', label: 'value' },
          { name: 'planned', color: COLORS.ref, pts: plan, dash: true, unit: '', quiet: true },
        ],
        empty: 'shown from the first saved checkpoint',
      };
    }
    if (id === 'c-grad') {
      const g = seriesOf('grad_norm');
      return {
        xmax, vlines, log: ST.logscale, min0: !ST.logscale, unit: 'norm', fmt: FMT.norm,
        series: [{ name: 'gradient norm', color: COLORS.ink, pts: ema(g, ST.smooth), raw: ST.smooth > 0 ? g : null, unit: '', smoothed: ST.smooth > 0, label: 'value' }],
        empty: 'shown from the first saved checkpoint',
      };
    }
    if (id === 'c-speed') {
      const sp = seriesOf('sec_per_step');
      return {
        xmax, vlines, min0: true, unit: 's/step', fmt: FMT.sps,
        series: [{ name: 'seconds per step', color: COLORS.ink, pts: sp, dots: sp.length < 60, unit: 's/step', label: 'value' }],
        empty: 'measured once two steps or two checkpoints are known',
      };
    }
    if (id === 'c-mem') {
      const lim = val('memory_limit_gb');
      const m = seriesOf('memory_gb');
      return {
        xmax, vlines, min0: true, unit: 'GB', fmt: FMT.gb,
        series: [{ name: 'memory', color: COLORS.ink, pts: m, dots: m.length < 60, unit: 'GB', label: 'value' }],
        hlines: isNum(lim) ? [{ y: lim, label: `limit ${lim.toFixed(0)} GB` }] : [],
        empty: s.status === 'done' || s.status === 'stopped' ? 'read only while the panel watched the run train'
          : 'needs the training process (live, or attached with its id or its run lock)',
      };
    }
    if (id === 'c-runs') {
      const sel = selRun();
      let xm = 1;
      const series = runCurves().map(({ r, pts, end }) => {
        for (const p of pts) xm = Math.max(xm, p[0]);
        if (isNum(end)) xm = Math.max(xm, end);
        const on = r.name === sel;
        return { name: r.label || r.name, color: on ? COLORS.dev : COLORS.train, pts, dots: on, width: on ? 2.4 : 1.4, opacity: on ? 1 : 0.55, unit: 'chrF++', front: on };
      }).sort((a, b) => (a.front ? 1 : 0) - (b.front ? 1 : 0));
      return { xmax: xm, vlines: [], min0: true, max100: true, unit: 'chrF++', fmt: FMT.chrf, series, many: true,
        xraw: ST.xmode === 'pass' ? 'passes' : null, empty: 'no run with a dev score yet' };
    }
    return { xmax, series: [] };
  }

  function defChart(id, aria) {
    const host = document.getElementById(id);
    if (!host) return;
    const svg = document.createElementNS(NS, 'svg');
    host.appendChild(svg);
    host.tabIndex = 0;
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', `${aria} — drag across to zoom, double-click to reset, arrow keys to read values`);
    const c = { id, host, svg, geo: null, data: null, drag: null, small: !!host.closest('.small') };
    CHARTS[id] = c;
    const local = (e) => { const r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    host.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !c.geo) return;
      const [px] = local(e);
      if (px < c.geo.m.l || px > c.geo.m.l + c.geo.pw) return;
      c.drag = { a: px, b: px };
      try { host.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    });
    host.addEventListener('pointermove', (e) => {
      if (!c.geo) return;
      const [px] = local(e);
      if (c.drag) {
        c.drag.b = clamp(px, c.geo.m.l, c.geo.m.l + c.geo.pw);
        const sel = svg.querySelector('.sel');
        if (sel) {
          const a = Math.min(c.drag.a, c.drag.b), w = Math.abs(c.drag.b - c.drag.a);
          sel.setAttribute('x', a); sel.setAttribute('width', w); sel.setAttribute('visibility', w > 2 ? 'visible' : 'hidden');
        }
      }
      setHover(c, c.geo.inv(clamp(px, c.geo.m.l, c.geo.m.l + c.geo.pw)), e.clientX, e.clientY);
    });
    const endDrag = (e, apply) => {
      if (!c.drag) return;
      const { a, b } = c.drag;
      c.drag = null;
      const sel = svg.querySelector('.sel');
      if (sel) sel.setAttribute('visibility', 'hidden');
      if (apply && Math.abs(b - a) >= 8) {
        ST.zoom = [c.geo.inv(Math.min(a, b)), c.geo.inv(Math.max(a, b))];
        redrawAll();
      }
    };
    host.addEventListener('pointerup', (e) => endDrag(e, true));
    host.addEventListener('pointercancel', (e) => endDrag(e, false));
    host.addEventListener('pointerleave', () => { if (!c.drag) clearHover(); });
    host.addEventListener('dblclick', () => { ST.zoom = null; redrawAll(); });
    host.addEventListener('keydown', (e) => {
      const xs = [...new Set((c.data ? c.data.series : []).flatMap((s) => (s.quiet ? [] : s.pts.map((p) => p[0]))))].sort((p, q) => p - q);
      if (!xs.length) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const cur = ST.hoverChart === id && isNum(ST.hoverStep) ? ST.hoverStep : (e.key === 'ArrowRight' ? -Infinity : Infinity);
        let nx;
        if (e.key === 'Home') nx = xs[0];
        else if (e.key === 'End') nx = xs[xs.length - 1];
        else nx = e.key === 'ArrowRight' ? xs.find((x) => x > cur) : [...xs].reverse().find((x) => x < cur);
        if (nx === undefined) return;
        const r = host.getBoundingClientRect();
        setHover(c, nx, r.left + (c.geo ? c.geo.X(nx) : 0), r.top + 30);
      } else if (e.key === 'Escape') {
        clearHover();
      } else if (e.key === '0') {
        ST.zoom = null; redrawAll();
      }
    });
    host.addEventListener('blur', () => clearHover());
  }

  const pathOf = (pts, X, Y) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('');

  function draw(c) {
    const W = Math.round(c.host.clientWidth), H = Math.round(c.host.clientHeight);
    if (!W || !H || c.host.offsetParent === null) return;
    const d = c.data = chartData(c.id);
    const small = c.small;
    const m = small ? { l: 38, r: 10, t: 14, b: 20 } : { l: 44, r: 14, t: 18, b: 24 };
    const pw = Math.max(10, W - m.l - m.r), ph = Math.max(10, H - m.t - m.b);
    let [x0, x1] = ST.zoom || [0, d.xmax || 1];
    if (!(x1 > x0)) x1 = x0 + 1;
    const X = (x) => m.l + ((x - x0) / (x1 - x0)) * pw;
    const inv = (px) => x0 + ((px - m.l) / pw) * (x1 - x0);
    const all = d.series.filter((s) => s.pts.length);
    let ys = [];
    for (const s of all) for (const p of visible(s.pts, x0, x1)) if (p[0] >= x0 && p[0] <= x1) ys.push(p[1]);
    for (const s of all) if (s.raw) for (const p of visible(s.raw, x0, x1)) if (p[0] >= x0 && p[0] <= x1) ys.push(p[1]);
    for (const h of d.hlines || []) { ys.push(h.y); if (isNum(h.lo)) ys.push(h.lo); if (isNum(h.hi)) ys.push(h.hi); }
    for (const e of d.err || []) if (e.x >= x0 && e.x <= x1) { ys.push(e.y); if (isNum(e.lo)) ys.push(e.lo); if (isNum(e.hi)) ys.push(e.hi); }
    ys = ys.filter(isNum);
    let svg = `<defs><clipPath id="clip-${c.id}"><rect x="${m.l}" y="${m.t - 6}" width="${pw}" height="${ph + 12}"/></clipPath>`
      + `<pattern id="hatch-${c.id}" class="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6"/></pattern></defs>`;
    const hasData = (all.some((s) => !s.quiet) || (d.err || []).length) && ys.length;
    let Y, log = false, ticks = [], y0 = 0, y1 = 1, llo = 0, lhi = 1, exp = 0;
    const nTicks = small ? 3 : 4;
    if (hasData) {
      log = !!d.log && ys.every((v) => v > 0);
      if (log) {
        const lo = Math.log10(Math.min(...ys)), hi = Math.log10(Math.max(...ys)), pad = Math.max(0.04, (hi - lo) * 0.06);
        llo = lo - pad; lhi = hi + pad;
        Y = (v) => m.t + (1 - (Math.log10(Math.max(v, 1e-12)) - llo) / (lhi - llo)) * ph;
        ticks = logTicks(llo, lhi);
        if (small && ticks.length > 4) ticks = ticks.filter((v) => Math.abs(Math.log10(v) - Math.round(Math.log10(v))) < 1e-9);
      } else {
        let lo = d.min0 ? 0 : Math.min(...ys), hi = Math.max(...ys);
        if (!(hi > lo)) { hi = lo + (Math.abs(lo) || 1) * 0.5; if (!d.min0) lo -= (Math.abs(lo) || 1) * 0.5; }
        const pad = (hi - lo) * 0.08;
        if (!d.min0) lo = Math.max(lo - pad, Math.min(...ys) >= 0 ? 0 : -Infinity);
        hi += pad;
        const st = niceStep(hi - lo, nTicks);
        y0 = d.min0 ? 0 : Math.floor(lo / st) * st; y1 = Math.ceil(hi / st) * st;
        if (d.max100) y1 = Math.min(y1, 100);
        if (!(y1 > y0)) y1 = y0 + st;
        ticks = niceTicks(y0, y1, nTicks);
        Y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * ph;
        if (d.kind === 'sci') exp = Math.floor(Math.log10(Math.max(Math.abs(y1), 1e-30)));
      }
      const tstep = ticks.length > 1 ? (ticks[1] - ticks[0]) / 10 ** exp : 1;
      for (const v of ticks) {
        const y = Y(v).toFixed(1);
        const lab = log ? (v >= 1000 ? int(v) : String(+v.toPrecision(2))) : tickLabel(v / 10 ** exp, tstep);
        svg += `<line class="gl" x1="${m.l}" x2="${m.l + pw}" y1="${y}" y2="${y}"/>`;
        svg += `<text x="${m.l - 7}" y="${(+y + 3.5).toFixed(1)}" text-anchor="end">${esc(lab)}</text>`;
      }
    } else {
      Y = () => m.t + ph / 2;
    }
    // x axis, in steps or passes
    const spp = d.xraw ? 1 : stepsPerPass();
    const passes = !!d.xraw || (ST.xmode === 'pass' && spp);
    const nx = Math.max(small ? 2 : 3, Math.floor(pw / (small ? 70 : 80)));
    const xt = !hasData && !(d.xmax > 1) ? [] : passes ? niceTicks(x0 / spp, x1 / spp, nx).map((t) => t * spp) : niceTicks(x0, x1, nx);
    svg += `<line class="ax" x1="${m.l}" x2="${m.l + pw}" y1="${m.t + ph}" y2="${m.t + ph}"/>`;
    for (const t of xt) {
      const x = X(t);
      if (x < m.l - 1 || x > m.l + pw + 1) continue;
      const lab = passes ? String(+(t / spp).toFixed(2)) : (small && t >= 1000 ? `${+(t / 1000).toFixed(1)}k` : int(t));
      svg += `<text x="${x.toFixed(1)}" y="${m.t + ph + (small ? 14 : 16)}" text-anchor="middle">${esc(lab)}</text>`;
    }
    const unitLabel = exp ? `× 10${sup(exp)} ${d.unit || ''}` : (d.unit || '');
    svg += `<text class="ulabel" x="${m.l}" y="${m.t - (small ? 4 : 7)}">${esc(unitLabel)}</text>`;
    if (!small) svg += `<text class="ulabel" x="${m.l + pw}" y="${m.t - 7}" text-anchor="end">${passes ? 'passes' : 'step'}</text>`;
    svg += `<g clip-path="url(#clip-${c.id})">`;
    if (hasData) {
      for (const z of d.zones || []) {             // the patience window: where it stops without a new best
        const za = clamp(X(z.x0), m.l, m.l + pw), zb = clamp(X(z.x1), m.l, m.l + pw);
        if (zb > za) svg += `<rect class="zone" style="fill:url(#hatch-${c.id})" x="${za.toFixed(1)}" y="${m.t}" width="${(zb - za).toFixed(1)}" height="${ph}"/>`;
        if (z.x1 >= x0 && z.x1 <= x1) svg += `<line class="zline" x1="${X(z.x1).toFixed(1)}" x2="${X(z.x1).toFixed(1)}" y1="${m.t}" y2="${m.t + ph}"/>`;
      }
      for (const b of d.bars || []) {
        const ba = clamp(X(b.x0), m.l, m.l + pw), bb = clamp(X(b.x1), m.l, m.l + pw);
        if (bb > ba) svg += `<line class="bar" x1="${ba.toFixed(1)}" x2="${bb.toFixed(1)}" y1="${Y(b.y).toFixed(1)}" y2="${Y(b.y).toFixed(1)}"/>`;
      }
      for (const h of d.hlines || []) {
        if (isNum(h.lo) && isNum(h.hi)) svg += `<rect class="band" x="${m.l}" width="${pw}" y="${Math.min(Y(h.hi), Y(h.lo)).toFixed(1)}" height="${Math.abs(Y(h.lo) - Y(h.hi)).toFixed(1)}"/>`;
        svg += `<line class="ref" x1="${m.l}" x2="${m.l + pw}" y1="${Y(h.y).toFixed(1)}" y2="${Y(h.y).toFixed(1)}"/>`;
      }
      for (const s of all) {
        if (!s.raw || !s.raw.length) continue;
        const vr = downsample(visible(s.raw, x0, x1), X, pw);
        svg += `<path d="${pathOf(vr, X, Y)}" style="fill:none;stroke:${s.color};stroke-width:1;opacity:.28;stroke-linejoin:round"/>`;
      }
      for (const s of all) {
        const vp = downsample(visible(s.pts, x0, x1), X, pw);
        if (!vp.length) continue;
        const w = s.width || (s.dots ? 2 : (s.raw ? 2 : 1.6));
        svg += `<path d="${pathOf(vp, X, Y)}" style="fill:none;stroke:${s.color};stroke-width:${w};stroke-linejoin:round;stroke-linecap:round;${s.dash ? 'stroke-dasharray:5 4;' : ''}${s.opacity ? `opacity:${s.opacity};` : ''}"/>`;
        if (s.dots && vp.length <= 120) {
          for (const p of vp) {
            if (p[0] < x0 || p[0] > x1) continue;
            const fill = !s.dotFill || s.dotFill(p) ? s.color : 'var(--surface)';
            svg += `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="${s.dotFill ? 3.8 : 3.5}" style="fill:${fill};stroke:${s.dotFill ? s.color : 'var(--surface)'};stroke-width:${s.dotFill ? 1.8 : 2}"/>`;
          }
        }
      }
      if (d.ring && d.ring[0] >= x0 && d.ring[0] <= x1) {
        svg += `<circle cx="${X(d.ring[0]).toFixed(1)}" cy="${Y(d.ring[1]).toFixed(1)}" r="8.5" style="fill:none;stroke:var(--dev);stroke-width:1.6"/>`;
      }
      for (const mk of d.marks || []) {
        if (mk.x < x0 || mk.x > x1) continue;
        svg += `<circle cx="${X(mk.x).toFixed(1)}" cy="${Y(mk.y).toFixed(1)}" r="7" style="fill:none;stroke:var(--dev);stroke-width:1.3;stroke-dasharray:2 2"/>`;
        svg += `<text class="ulabel" x="${X(mk.x).toFixed(1)}" y="${(Y(mk.y) + 18).toFixed(1)}" text-anchor="middle">${esc(mk.label)}</text>`;
      }
      for (const e of d.err || []) {
        if (e.x < x0 || e.x > x1) continue;
        const x = X(e.x).toFixed(1);
        if (isNum(e.lo) && isNum(e.hi)) {
          svg += `<line x1="${x}" x2="${x}" y1="${Y(e.lo).toFixed(1)}" y2="${Y(e.hi).toFixed(1)}" style="stroke:var(--final);stroke-width:1.4"/>`;
          for (const v of [e.lo, e.hi]) svg += `<line x1="${+x - 4}" x2="${+x + 4}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" style="stroke:var(--final);stroke-width:1.4"/>`;
        }
        svg += `<circle cx="${x}" cy="${Y(e.y).toFixed(1)}" r="4.5" style="fill:${e.kept ? 'var(--final)' : 'var(--surface)'};stroke:var(--final);stroke-width:2"/>`;
        if (e.kept) svg += `<text class="ulabel" x="${+x + 8}" y="${(Y(e.y) + 4).toFixed(1)}" style="fill:var(--ink)">kept</text>`;
      }
      for (const r of d.rug || []) {                // checkpoints still on disk, along the step axis
        if (r.x < x0 || r.x > x1) continue;
        const x = X(r.x);
        svg += `<rect x="${(x - 3).toFixed(1)}" y="${m.t + ph - 7}" width="6" height="6" rx="1" style="fill:${r.kind === 'kept' ? 'var(--final)' : 'var(--ink-2)'};opacity:${r.kind === 'kept' ? 1 : 0.55}"/>`;
      }
    }
    for (const v of d.vlines || []) {
      if (v.x < x0 || v.x > x1) continue;
      const x = X(v.x).toFixed(1);
      svg += `<line class="ref" x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t + ph}"/>`;
      if (!small) svg += `<text class="ulabel" x="${+x + 4}" y="${m.t + 10}">${esc(v.label)}</text>`;
    }
    svg += '</g>';
    if (hasData) {
      for (const z of d.zones || []) {
        if (small || z.x1 < x0 || z.x1 > x1) continue;
        // inside the window's lower right, where a rising curve never is: left of the stop line when it fits
        const zx = X(z.x1), w = z.label.length * 5.8, inside = zx - X(Math.max(z.x0, x0)) > w + 10;
        const right = !inside && zx + 8 + w > m.l + pw;
        const ax = (inside || right ? zx - 6 : zx + 6).toFixed(1), anchor = inside || right ? 'end' : 'start';
        svg += `<text class="zlabel" x="${ax}" y="${m.t + ph - 26}" text-anchor="${anchor}">${esc(z.label)}</text>`;
        if (z.sub) svg += `<text class="zlabel" x="${ax}" y="${m.t + ph - 13}" text-anchor="${anchor}"><tspan>${esc(z.sub)}</tspan></text>`;
      }
      for (const h of d.hlines || []) {
        if (h.label) svg += `<text class="ulabel" x="${m.l + pw - 4}" y="${(Y(h.y) - 5).toFixed(1)}" text-anchor="end">${esc(h.label)}</text>`;
      }
      if (!small) svg += endLabels(d, all, X, Y, m, pw, x0, x1);   // a small chart's header carries the latest value
    } else {
      const words = String(d.empty || 'no data yet').split(' '), lines = [''], per = Math.max(14, Math.floor(pw / 6.6));
      for (const w of words) { if ((lines[lines.length - 1] + ' ' + w).trim().length > per) lines.push(w); else lines[lines.length - 1] = `${lines[lines.length - 1]} ${w}`.trim(); }
      const ly = m.t + ph / 2 - ((lines.length - 1) * 15) / 2;
      svg += `<text class="empty" x="${m.l + pw / 2}" y="${ly.toFixed(1)}" text-anchor="middle">${lines.map((l, i) => `<tspan x="${m.l + pw / 2}" dy="${i ? 15 : 0}">${esc(l)}</tspan>`).join('')}</text>`;
    }
    svg += `<rect class="sel" x="0" y="${m.t}" width="0" height="${ph}" visibility="hidden"/><g class="hov"></g>`;
    c.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    c.svg.innerHTML = svg;
    c.geo = { m, pw, ph, x0, x1, X, Y, inv, hasData };
    drawHover(c);
  }

  // Direct labels at the end of each line, in ink (never the series colour): the value the
  // header shows. A smoothed line is labelled at its RAW last point (marked with a dot on the
  // faint raw line), so the chart and the header never disagree. Labels never overlap.
  function endLabels(d, all, X, Y, m, pw, x0, x1) {
    if (d.many) return '';
    const labs = [];
    for (const s of all) {
      if (!s.label) continue;
      const src = s.raw && s.raw.length ? s.raw : s.pts;
      const last = src[src.length - 1];
      if (!last || last[0] < x0 || last[0] > x1) continue;
      const v = d.fmt ? d.fmt(last[1]) : String(last[1]);
      labs.push({ x: X(last[0]), y: Y(last[1]), name: s.label === 'name' ? s.name : '', v, color: s.color, dot: !!s.raw });
    }
    labs.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13;
    let out = '';
    for (const l of labs) {
      const w = (l.name.length + l.v.length + 1) * 6.4;
      const right = l.x + 8 + w > m.l + pw;
      if (l.dot) out += `<circle cx="${l.x.toFixed(1)}" cy="${l.y.toFixed(1)}" r="2.6" style="fill:${l.color};stroke:var(--surface);stroke-width:1.2"/>`;
      out += `<text class="elabel" x="${(right ? l.x - 7 : l.x + 7).toFixed(1)}" y="${(l.y - 6).toFixed(1)}" text-anchor="${right ? 'end' : 'start'}">`
        + `${l.name ? `<tspan class="n">${esc(l.name)} </tspan>` : ''}${esc(l.v)}</text>`;
    }
    return out;
  }

  function setHover(c, step, cx, cy) {
    ST.hoverStep = step; ST.hoverChart = c ? c.id : 'ext'; ST.hoverXY = c ? [cx, cy] : null;
    for (const k in CHARTS) drawHover(CHARTS[k]);
    for (const tr of $$('#checktable tbody tr')) tr.classList.toggle('hl', isNum(step) && +tr.dataset.step === nearestCheck(step));
  }
  function nearestCheck(step) {
    const steps = ((ST.hud && ST.hud.checks) || []).map((x) => x.step);
    if (!steps.length) return null;
    const best = steps.reduce((a, b) => (Math.abs(b - step) < Math.abs(a - step) ? b : a));
    return Math.abs(best - step) <= (val('check_every_steps') || Infinity) / 2 ? best : null;
  }
  function clearHover() {
    ST.hoverStep = null; ST.hoverChart = null;
    for (const k in CHARTS) drawHover(CHARTS[k]);
    for (const tr of $$('#checktable tbody tr.hl')) tr.classList.remove('hl');
    ctip.hidden = true;
  }
  function drawHover(c) {
    const g = c.svg.querySelector('.hov');
    if (!g) return;
    const geo = c.geo, d = c.data;
    if (!geo || !geo.hasData || ST.hoverStep == null || ST.hoverStep < geo.x0 || ST.hoverStep > geo.x1) {
      g.innerHTML = '';
      if (ST.hoverChart === c.id) ctip.hidden = true;
      return;
    }
    const own = ST.hoverChart === c.id;
    // snap to the nearest point of this chart's series
    let snap = ST.hoverStep, bd = Infinity;
    for (const s of d.series) {
      if (s.quiet || !s.pts.length) continue;
      const p = nearest(s.pts, ST.hoverStep);
      if (p && Math.abs(p[0] - ST.hoverStep) < bd) { bd = Math.abs(p[0] - ST.hoverStep); snap = p[0]; }
    }
    const x = geo.X(snap);
    let svg = `<line class="xh${ST.hoverChart === 'ext' ? ' ext' : ''}" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${geo.m.t}" y2="${geo.m.t + geo.ph}"/>`;
    const rows = [];
    for (const s of d.series) {
      if (!s.pts.length) continue;
      const p = nearest(s.pts, snap);
      if (!p) continue;
      const far = Math.abs(geo.X(p[0]) - x) > 28;
      if (!far) svg += `<circle cx="${geo.X(p[0]).toFixed(1)}" cy="${geo.Y(p[1]).toFixed(1)}" r="4.5" style="fill:${s.color};stroke:var(--surface);stroke-width:2"/>`;
      if (d.many && far) continue;
      rows.push({ s, p, far });
    }
    g.innerHTML = svg;
    if (!own) return;
    // the readout: values lead, names follow, every value with its unit
    const spp = stepsPerPass();
    ctip.replaceChildren();
    const h = document.createElement('div'); h.className = 'h';
    const saved = ((ST.hud && ST.hud.checkpoints) || []).some((ck) => ck.step === snap);
    h.textContent = d.xraw ? `pass ${snap.toFixed(2)}`
      : `step ${int(snap)}${spp ? ` · pass ${(snap / spp).toFixed(2)}` : ''}${saved && c.id === 'c-score' ? ' · checkpoint on disk' : ''}`;
    ctip.append(h);
    if (d.many) rows.sort((a, b) => b.p[1] - a.p[1]);
    const unitOf = (s) => (s.unit ? ` ${s.unit}` : (d.unit && d.unit !== 'per step' && d.unit !== 'norm' ? ` ${d.unit}` : ''));
    for (const { s, p, far } of rows.slice(0, 9)) {
      const r = document.createElement('div'); r.className = 'r';
      const k = document.createElement('i'); k.className = 'lk';
      k.style.borderTopColor = s.color; if (s.dash) k.style.borderTopStyle = 'dashed';
      const b = document.createElement('b');
      b.textContent = `${d.fmt ? d.fmt(p[1]) : p[1].toFixed(2)}${unitOf(s)}`;
      const sp = document.createElement('span');
      let extra = '';
      if (s.delta) {
        const i = s.pts.indexOf(p);
        if (i > 0) { const dd = p[1] - s.pts[i - 1][1]; extra = ` (${dd >= 0 ? '+' : '−'}${Math.abs(dd).toFixed(1)})`; }
      }
      if (s.smoothed && s.raw) {
        const rp = nearest(s.raw, p[0]);
        if (rp) extra += ` · raw ${d.fmt ? d.fmt(rp[1]) : rp[1].toFixed(2)}`;
      }
      sp.textContent = `${s.name}${s.smoothed ? ' · smoothed' : ''}${extra}${far ? ` · at step ${int(p[0])}` : ''}`;
      r.append(k, b, sp);
      ctip.append(r);
    }
    for (const e of d.err || []) {
      if (Math.abs(geo.X(e.x) - x) > 6) continue;
      const r = document.createElement('div'); r.className = 'r';
      const k = document.createElement('i'); k.className = 'lk final';
      const b = document.createElement('b'); b.textContent = `${e.y.toFixed(1)} chrF++`;
      const sp = document.createElement('span');
      sp.textContent = `final, all dev pairs${isNum(e.lo) ? ` · 95% ${e.lo.toFixed(1)}–${e.hi.toFixed(1)}` : ''}${e.kept ? ' · kept' : ''}`;
      r.append(k, b, sp); ctip.append(r);
    }
    ctip.hidden = false;
    const [cx, cy] = ST.hoverXY || [0, 0];
    const tw = ctip.offsetWidth, th = ctip.offsetHeight, vw = document.documentElement.clientWidth;
    ctip.style.left = `${cx + 14 + tw > vw - 8 ? Math.max(8, cx - tw - 14) : cx + 14}px`;
    ctip.style.top = `${clamp(cy - th - 12, 8, window.innerHeight - th - 8)}px`;
  }

  let rafPending = false;
  function redrawAll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      for (const k in CHARTS) draw(CHARTS[k]);
      drawSparks();
      if (ST.view === 'runs') { drawForest(); drawMultiples(); }
      $('#resetzoom').hidden = !ST.zoom;
      $('#zoomhint').textContent = ST.zoom
        ? `showing steps ${int(ST.zoom[0])}–${int(ST.zoom[1])} · double-click to reset`
        : 'drag across a chart to zoom · double-click to reset · arrow keys read values';
    });
  }
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => redrawAll());
    setTimeout(() => { for (const k in CHARTS) ro.observe(CHARTS[k].host); ro.observe($('.health')); ro.observe($('#forest')); }, 0);
  } else {
    window.addEventListener('resize', redrawAll);
  }
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', redrawAll);
  }

  defChart('c-score', 'Dev score (chrF++, 0 to 100) at each check, by training step, with the best so far, the patience window and the checkpoints on disk');
  defChart('c-loss', 'Train and dev loss by training step');
  defChart('c-lr', 'Learning rate by training step, with the planned schedule');
  defChart('c-grad', 'Gradient norm by training step');
  defChart('c-speed', 'Seconds per training step');
  defChart('c-mem', 'Memory held by the training process, in GB');
  defChart('c-runs', 'Dev score of each run by training step');

  // ---------------------------------------------------------------- toolbar ----
  for (const b of $$('[data-x]')) {
    b.setAttribute('aria-pressed', String(b.dataset.x === ST.xmode));
    b.addEventListener('click', () => {
      ST.xmode = b.dataset.x; store.set('nmtf-x', ST.xmode);
      ST.zoom = null;
      for (const o of $$('[data-x]')) o.setAttribute('aria-pressed', String(o.dataset.x === ST.xmode));
      redrawAll();
    });
  }
  const sm = $('#smooth');
  sm.value = String(ST.smooth);
  $('#smoothv').textContent = ST.smooth.toFixed(2);
  sm.addEventListener('input', () => {
    ST.smooth = parseFloat(sm.value) || 0; store.set('nmtf-smooth', String(ST.smooth));
    $('#smoothv').textContent = ST.smooth.toFixed(2);
    redrawAll();
  });
  const lg = $('#logloss');
  lg.checked = ST.logscale;
  lg.addEventListener('change', () => { ST.logscale = lg.checked; store.set('nmtf-log', lg.checked ? 'on' : 'off'); redrawAll(); });
  $('#resetzoom').addEventListener('click', () => { ST.zoom = null; redrawAll(); });

  // ------------------------------------------------------------ stop control ----
  function hideConfirm() { $('#confirm').hidden = true; }
  $('#stopbtn').addEventListener('click', () => { $('#confirm').hidden = false; $('#cancelbtn').focus(); });
  $('#cancelbtn').addEventListener('click', hideConfirm);
  $('#killbtn').addEventListener('click', async () => {
    hideConfirm();
    try { await fetch('/stop', { method: 'POST' }); } catch (e) { /* the status line will say */ }
    tick();
  });

  // ----------------------------------------------------------------- views ----
  function setView(v, focus) {
    ST.view = v;
    for (const b of $$('[data-view]')) {
      const on = b.dataset.view === v;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    }
    $('#view-run').hidden = v !== 'run';
    $('#view-runs').hidden = v !== 'runs';
    hideTip(); clearHover();
    try { window.history.replaceState(null, '', v === 'runs' ? '#runs' : '#'); } catch (e) { /* fine */ }
    if (v === 'runs') loadRuns(true);
    redrawAll();
  }
  for (const b of $$('[data-view]')) {
    b.addEventListener('click', () => setView(b.dataset.view));
    b.addEventListener('keydown', (e) => {       // a tab list: arrows move between the two views
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setView(ST.view === 'run' ? 'runs' : 'run', true); }
    });
  }

  // The runs: which is better (a dot-and-range plot), the shapes (small multiples), the table.
  const selRun = () => ST.runsHL || ST.runsPin || (ST.runs && ST.runs.current);
  // each run's dev curve, by steps or by passes through its OWN pairs (a run with no recorded plan
  // cannot be put in passes and is left out of that view, never guessed)
  function runCurves() {
    const byPass = ST.xmode === 'pass';
    return runsList().filter((r) => r.curve && r.curve.length).map((r) => {
      const spp = isNum(r.planned) && isNum(r.epochs) && r.epochs > 0 ? r.planned / r.epochs : null;
      if (!byPass) return { r, pts: r.curve, end: r.planned, k: 1 };
      if (!spp) return null;
      return { r, pts: r.curve.map(([x, y]) => [x / spp, y]), end: r.epochs, k: 1 / spp };
    }).filter(Boolean);
  }
  const runsList = () => ((ST.runs && ST.runs.runs) || []).filter((r) => !r.error);
  const devOf = (name) => (runsList().find((r) => r.name === name) || {}).dev_set;
  const stepOfCkpt = (name) => { const m = /checkpoint-(\d+)$/.exec(String(name || '')); return m ? +m[1] : null; };
  function pin(name) { ST.runsPin = ST.runsPin === name ? null : name; renderRuns(); }
  function hl(name) { ST.runsHL = name; draw(CHARTS['c-runs']); drawForest(); markRuns(); }
  function markRuns() {
    const on = selRun();
    for (const el of $$('[data-run]')) el.classList.toggle('on', el.dataset.run === on);
  }

  function drawForest() {
    const host = $('#forest');
    if (!host || host.offsetParent === null) return;
    const curDev = devOf(ST.runs && ST.runs.current);
    const rows = runsList().filter((r) => (r.final && isNum(r.final.score)) || r.best).map((r) => ({
      r, fin: r.final && isNum(r.final.score) ? r.final : null, best: r.best ? r.best.score : null,
      key: r.final && isNum(r.final.score) ? r.final.score : (r.best ? r.best.score : -1),
      off: !!(curDev && r.dev_set && r.dev_set !== curDev),
    })).sort((a, b) => (b.fin ? 1 : 0) - (a.fin ? 1 : 0) || b.key - a.key);
    if (!rows.length) {
      host.innerHTML = `<svg viewBox="0 0 300 60" height="60"><text x="0" y="30" class="tag">no run has a dev score yet</text></svg>`;
      return;
    }
    const W = Math.max(280, Math.round(host.clientWidth)), top = 26;
    const narrow = W < 520;                   // a phone: each run's name on its own line, the marks under it
    const rowH = narrow ? 44 : 30;
    const labelW = narrow ? W - 80 : Math.min(250, Math.round(W * 0.36)), valW = narrow ? 70 : 118;
    const pl = narrow ? 6 : labelW + 10, pr = W - valW - 8;
    const vals = [];
    for (const x of rows) {
      if (x.fin) { vals.push(x.fin.score); if (Array.isArray(x.fin.ci)) vals.push(...x.fin.ci.filter(isNum)); }
      if (isNum(x.best)) vals.push(x.best);
    }
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const st = niceStep(Math.max(hi - lo, 4), 4);
    lo = Math.max(0, Math.floor((lo - st * 0.3) / st) * st); hi = Math.min(100, Math.ceil((hi + st * 0.3) / st) * st);
    if (!(hi > lo)) hi = lo + st;
    const X = (v) => pl + ((v - lo) / (hi - lo)) * (pr - pl);
    const H = top + rows.length * rowH + 6;
    let s = '';
    const fticks = niceTicks(lo, hi, narrow ? 3 : 5);
    for (const t of fticks) {
      s += `<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${top - 4}" y2="${H - 4}" style="stroke:var(--grid)"/>`;
      s += `<text x="${X(t).toFixed(1)}" y="${top - 10}" text-anchor="middle">${esc(tickLabel(t, fticks.length > 1 ? fticks[1] - fticks[0] : 1))}</text>`;
    }
    const lead = rows.find((x) => x.fin && Array.isArray(x.fin.ci) && isNum(x.fin.ci[0]) && !x.off);
    if (lead) s += `<rect class="topband" x="${X(lead.fin.ci[0]).toFixed(1)}" y="${top - 4}" width="${Math.max(1, X(lead.fin.ci[1]) - X(lead.fin.ci[0])).toFixed(1)}" height="${H - top}"/>`;
    const on = selRun();
    rows.forEach((x, i) => {
      const yc = top + i * rowH + rowH / 2, y = narrow ? yc + 8 : yc, ly = narrow ? yc - 9 : yc, r = x.r;
      const label = r.label || r.name;
      const maxc = Math.floor(labelW / 6.6);
      const short = label.length > maxc ? `${label.slice(0, maxc - 1)}…` : label;
      s += `<g class="row${r.name === on ? ' on' : ''}${x.off ? ' off' : ''}" data-run="${esc(r.name)}">`;
      s += `<rect class="hit" x="0" y="${yc - rowH / 2}" width="${W}" height="${rowH}" rx="6"/>`;
      s += `<text class="rl" x="4" y="${ly + 4}"><title>${esc(label)}${isNum(r.pairs) ? ` · ${int(r.pairs)} pairs` : ''}${x.off ? ' · scored on a different dev set' : ''}</title>${esc(short)}</text>`;
      if (x.fin) {
        const ci = Array.isArray(x.fin.ci) && isNum(x.fin.ci[0]) && isNum(x.fin.ci[1]) ? x.fin.ci : null;
        if (ci) {
          s += `<line class="ci" x1="${X(ci[0]).toFixed(1)}" x2="${X(ci[1]).toFixed(1)}" y1="${y}" y2="${y}"/>`;
          for (const v of ci) s += `<line class="ci" x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${y - 5}" y2="${y + 5}"/>`;
        }
        s += `<circle cx="${X(x.fin.score).toFixed(1)}" cy="${y}" r="5" style="fill:var(--final);stroke:var(--surface);stroke-width:1.5"/>`;
      }
      if (isNum(x.best)) s += `<circle cx="${X(x.best).toFixed(1)}" cy="${y}" r="4.5" style="fill:none;stroke:${r.name === on ? 'var(--dev)' : 'var(--muted)'};stroke-width:1.8"/>`;
      const txt = x.fin ? `${x.fin.score.toFixed(1)}${!narrow && Array.isArray(x.fin.ci) && isNum(x.fin.ci[0]) ? ` (${x.fin.ci[0].toFixed(1)}–${x.fin.ci[1].toFixed(1)})` : ''}` : `best ${x.best.toFixed(1)}`;
      s += `<text class="${x.fin ? 'val' : 'tag'}" x="${W - 4}" y="${ly + 4}" text-anchor="end">${esc(txt)}</text>`;
      if (x.off && !narrow) s += `<text class="tag" x="${pl}" y="${y + rowH / 2 - 2}">other dev set</text>`;
      s += '</g>';
    });
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}">${s}</svg>`;
    for (const g of $$('.row', host)) {
      g.addEventListener('mouseenter', () => hl(g.dataset.run));
      g.addEventListener('mouseleave', () => hl(null));
      g.addEventListener('click', () => pin(g.dataset.run));
    }
  }

  function renderMultiples() {
    const box = $('#multiples');
    const runs = runsList().filter((r) => r.curve && r.curve.length);
    const key = JSON.stringify(runs.map((r) => [r.name, r.curve.length, r.final && r.final.score, r.status]));
    if (box.dataset.key !== key) {
      box.dataset.key = key;
      box.replaceChildren(...(runs.length ? runs.map((r) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'mult'; b.dataset.run = r.name;
        const t = document.createElement('span'); t.className = 'mt'; t.textContent = r.label || r.name;
        const sub = document.createElement('span'); sub.className = 'ms';
        const fin = r.final && isNum(r.final.score) ? `final ${r.final.score.toFixed(1)}${Array.isArray(r.final.ci) && isNum(r.final.ci[0]) ? ` (${r.final.ci[0].toFixed(1)}–${r.final.ci[1].toFixed(1)})` : ''}` : r.status || '';
        sub.textContent = [r.best ? `best ${r.best.score.toFixed(1)}` : '', fin, isNum(r.pairs) ? `${int(r.pairs)} pairs` : ''].filter(Boolean).join(' · ');
        const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('aria-hidden', 'true');
        b.setAttribute('aria-label', `${r.label || r.name}: ${sub.textContent}`);
        b.append(t, sub, svg);
        b.addEventListener('click', () => pin(r.name));
        b.addEventListener('mouseenter', () => hl(r.name));
        b.addEventListener('mouseleave', () => hl(null));
        return b;
      }) : [Object.assign(document.createElement('p'), { className: 'unit', textContent: 'no run with a dev score yet' })]));
    }
    drawMultiples();
  }
  function drawMultiples() {
    const curves = runCurves();
    const runs = curves.map((c) => c.r);
    if (!runs.length) return;
    const C = new Map(curves.map((c) => [c.r.name, c]));
    let xm = 1, ym = 1;
    for (const c of curves) {
      for (const p of c.pts) { xm = Math.max(xm, p[0]); ym = Math.max(ym, p[1]); }
      if (isNum(c.end)) xm = Math.max(xm, c.end);
      if (c.r.final && Array.isArray(c.r.final.ci) && isNum(c.r.final.ci[1])) ym = Math.max(ym, c.r.final.ci[1]);
    }
    const yTop = Math.min(100, Math.ceil(ym / niceStep(ym, 2)) * niceStep(ym, 2));
    for (const b of $$('#multiples .mult')) {
      const cv = C.get(b.dataset.run);
      const svg = b.querySelector('svg');
      b.hidden = !cv;
      if (!cv || !svg) continue;
      const r = cv.r;
      const W = Math.round(svg.clientWidth) || 220, H = 96, m = { l: 22, r: 6, t: 6, b: 14 };
      const X = (x) => m.l + (x / xm) * (W - m.l - m.r), Y = (v) => m.t + (1 - v / yTop) * (H - m.t - m.b);
      let s = '';
      for (const t of [0, yTop / 2, yTop]) {
        s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" style="stroke:var(--grid)"/>`;
        s += `<text x="${m.l - 4}" y="${(Y(t) + 3).toFixed(1)}" text-anchor="end">${+t.toFixed(0)}</text>`;
      }
      s += `<text x="${W - m.r}" y="${H - 2}" text-anchor="end">${ST.xmode === 'pass' ? `${+xm.toFixed(1)} passes` : `${int(xm)} steps`}</text>`;
      for (const o of curves) {
        if (o.r === r) continue;
        s += `<path d="${pathOf(o.pts, X, Y)}" style="fill:none;stroke:var(--train);stroke-width:1;opacity:.35"/>`;
      }
      s += `<path d="${pathOf(cv.pts, X, Y)}" style="fill:none;stroke:var(--dev);stroke-width:1.8;stroke-linejoin:round"/>`;
      if (r.best) s += `<circle cx="${X(r.best.step * cv.k).toFixed(1)}" cy="${Y(r.best.score).toFixed(1)}" r="3.2" style="fill:var(--dev);stroke:var(--surface);stroke-width:1.2"/>`;
      if (r.final && isNum(r.final.score)) {
        const fx = X((stepOfCkpt(r.selected) ?? r.curve[r.curve.length - 1][0]) * cv.k);
        const ci = Array.isArray(r.final.ci) && isNum(r.final.ci[0]) && isNum(r.final.ci[1]) ? r.final.ci : null;
        if (ci) s += `<line x1="${fx.toFixed(1)}" x2="${fx.toFixed(1)}" y1="${Y(ci[0]).toFixed(1)}" y2="${Y(ci[1]).toFixed(1)}" style="stroke:var(--final);stroke-width:1.5"/>`;
        s += `<circle cx="${fx.toFixed(1)}" cy="${Y(r.final.score).toFixed(1)}" r="3" style="fill:var(--final)"/>`;
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = s;
    }
    markRuns();
  }

  function cell(text, cls, value) {
    const td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = text;
    if (value !== undefined && value !== null) td.dataset.value = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return td;
  }
  function renderRuns() {
    const R = ST.runs || {};
    const runs = R.runs || [];
    const curDev = devOf(R.current);
    $('#runsroots').textContent = `${runs.length} run${runs.length === 1 ? '' : 's'}${R.roots ? ` · from ${R.roots.length} folder${R.roots.length === 1 ? '' : 's'}` : ''}`;
    const tb = $('#runstable tbody');
    tb.replaceChildren(...runs.map((r) => {
      const tr = document.createElement('tr');
      tr.dataset.run = r.name;
      const name = document.createElement('td'); name.className = 'name';
      const key = document.createElement('i'); key.className = 'lk';
      key.style.borderTopColor = r.name === selRun() ? 'var(--dev)' : 'var(--train)';
      const b = document.createElement('b'); b.textContent = r.label || r.name;
      const s = document.createElement('small'); s.textContent = r.label ? r.name : (r.name === R.current ? 'this run' : '');
      b.prepend(key);
      name.append(b, s);
      const langs = r.languages ? [r.languages.from, r.languages.to].filter(Boolean).join(' → ') : '';
      const fin = r.final && isNum(r.final.score) ? `${r.final.score.toFixed(1)}${Array.isArray(r.final.ci) && isNum(r.final.ci[0]) ? ` (${r.final.ci[0].toFixed(1)}–${r.final.ci[1].toFixed(1)})` : ''}` : '—';
      const prov = r.provider === 'runpod' ? 'RunPod' : r.provider;
      const where = r.where === 'semi-sovereign' ? `semi-sovereign${prov ? ` · ${prov}` : ''}${isNum(r.usd) ? ` · $${r.usd.toFixed(2)}` : ''}` : (r.where || '—');
      const other = curDev && r.dev_set && r.dev_set !== curDev;
      tr.append(
        name,
        cell(r.status || '—', '', r.status),
        cell(where, '', r.where),
        Object.assign(cell(r.model || '—', '', r.model), { title: langs }),
        cell(isNum(r.pairs) ? int(r.pairs) : '—', 'n', r.pairs),
        cell(r.dev_set ? `${r.dev_set}${isNum(r.dev_pairs) ? ` · ${int(r.dev_pairs)}` : ''}${other ? ' (other)' : ''}` : '—', other ? 'other' : '', r.dev_set),
        cell(isNum(r.step) ? `${int(r.step)}${isNum(r.planned) ? ` / ${int(r.planned)}` : ''}` : '—', 'n', r.step),
        cell(r.best ? `${r.best.score.toFixed(1)} · step ${int(r.best.step)}` : '—', 'n', r.best),
        cell(fin, 'n', r.final),
        cell(isNum(r.started) ? new Date(r.started * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—', '', r.started),
      );
      tr.addEventListener('mouseenter', () => hl(r.name));
      tr.addEventListener('mouseleave', () => hl(null));
      tr.addEventListener('click', () => pin(r.name));
      return tr;
    }));
    renderMultiples();
    draw(CHARTS['c-runs']);
    drawForest();
    markRuns();
  }
  async function loadRuns(force) {
    if (!force && Date.now() - ST.runsAt < 20000) return;
    ST.runsAt = Date.now();
    try { ST.runs = await getJSON('/runs'); renderRuns(); } catch (e) { /* keep the last table */ }
  }

  // ---------------------------------------------------------------- polling ----
  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
  function renderHud() {
    renderFields();
    drawScoreGauge(); drawSteps(); drawMeters(); drawSparks();
    renderSettings(); renderChecks(); renderCheckpoints();
    announce();
  }
  let busy = false;
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const s = await getJSON(`/status?v=${ST.v}`);
      let changed = false;
      if (!s.same) { ST.raw = s; ST.v = s.version; changed = true; }
      if (changed || Date.now() - ST.hudAt > 5000) {
        const h = await getJSON('/hud.json');
        ST.hud = h; ST.hudAt = Date.now();
        ST.online = true;
        renderHud();
      } else if (!ST.online) { ST.online = true; renderFields(); }
      if (changed) { renderEvents(); redrawAll(); }
      if (ST.view === 'runs') loadRuns(false);
    } catch (e) {
      if (ST.online) { ST.online = false; renderFields(); }
    } finally {
      busy = false;
    }
  }
  (async () => {
    try {
      const h = await getJSON('/hud.json?help=1');
      ST.help = h.help || {};
      ST.hud = h; ST.hudAt = Date.now();
      renderHud();
    } catch (e) { /* tick() will retry */ }
    makeFocusable();
    if (window.location.hash === '#runs') setView('runs');
    await tick();
    setInterval(() => { if (!document.hidden) tick(); }, 2000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  })();
})();
