import React, {useEffect, useRef, useState} from 'react';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';

import {addLockPop} from '../utils/lockPop.mjs';
import {edgeRecolor, morphFlights, routeTrace, hexForTier, glowForTier} from '../utils/networkEffects.mjs';
import {QUALITY, SLATE, tierForScore} from '../utils/qualityColors.mjs';
import {BRAND, NEUTRAL} from '../utils/brandColors.mjs';
import {dotStyle} from '../components/primitives/dot.mjs';
import {edgeStyle} from '../components/primitives/edge.mjs';
import styles from './seam-studio.module.css';

/**
 * /seam-studio — proofs for the merged "living network" seam. Unlinked, noindex.
 *
 *   A. Pacing + lock-and-pop dwell (the problem field).
 *   B. THE LIVING NETWORK — Champollion's story, not an abstract graph:
 *      the SAME dots as the problem field ARE the nodes; the network forms
 *      between the served (green) dots; a continuous QUEUE (a zipper — corpora
 *      built, tested pair by pair) runs on the right and keeps feeding finished
 *      pairs back into the network, filling it in and strengthening it; and a
 *      low-resource bridge going green opens up a whole cluster of paths.
 *
 * Dev handle: window.__STUDIO. Each POC has a scrub slider + play.
 */

const VW = 640;
const VH = 360;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ================================================================
   THE SHARED FIELD — one set of dots = languages. POC A draws it as
   the "problem field"; POC B uses the SAME positions as the network's
   nodes (founder: they're conceptually the same). Named nodes carry the
   story (served hubs, the Faroese→Danish→Spanish→Quechua chain, and the
   indigenous cluster behind Quechua); the rest are the uncovered sea.
   ================================================================ */
const fRand = mulberry32(7);
const ANON = Array.from({length: 180}, () => ({
  x: 12 + fRand() * (VW - 24),
  y: 10 + fRand() * (VH - 20),
}));

// Named nodes. served=1 → a covered language (green, part of the network).
const NAMED = [
  // served hubs, spread across the field (the existing measured network)
  {code: 'eng', x: 360, y: 118, served: 1, hub: 1, label: 'English'},
  {code: 'spa', x: 232, y: 182, served: 1, hub: 1, label: 'Spanish'},
  {code: 'por', x: 262, y: 224, served: 1, label: 'Português'},
  {code: 'fra', x: 330, y: 166, served: 1, label: 'français'},
  {code: 'deu', x: 396, y: 96, served: 1, hub: 1, label: 'Deutsch'},
  {code: 'nld', x: 350, y: 88, served: 1},
  {code: 'ita', x: 300, y: 206, served: 1},
  {code: 'rus', x: 452, y: 86, served: 1, hub: 1, label: 'русский'},
  {code: 'tur', x: 420, y: 148, served: 1},
  {code: 'ara', x: 472, y: 208, served: 1, label: 'العربية'},
  {code: 'hin', x: 500, y: 176, served: 1},
  {code: 'cmn', x: 508, y: 150, served: 1, hub: 1, label: '中文'},
  {code: 'jpn', x: 542, y: 116, served: 1},
  {code: 'vie', x: 524, y: 232, served: 1},
  {code: 'swa', x: 432, y: 278, served: 1},
  {code: 'dan', x: 288, y: 116, served: 1, label: 'Dansk'},
  // the chain endpoints / low-resource story (NOT served yet)
  {code: 'fao', x: 316, y: 62, label: 'Føroyskt'},
  {code: 'que', x: 145, y: 272, label: 'Runasimi'},
  // the indigenous cluster behind Quechua (unserved — opens up later)
  {code: 'aym', x: 92, y: 318, label: 'Aymar'},
  {code: 'grn', x: 186, y: 330},
  {code: 'quz', x: 106, y: 240},
  {code: 'shp', x: 66, y: 286},
  {code: 'gn2', x: 206, y: 300},
  {code: 'qu3', x: 150, y: 344},
];
const POS = Object.fromEntries(NAMED.map((n) => [n.code, [n.x, n.y]]));
const SERVED_CODES = NAMED.filter((n) => n.served).map((n) => n.code);
const CLUSTER_CODES = ['aym', 'grn', 'quz', 'shp', 'gn2', 'qu3'];

// The served network — each served hub to its 2 nearest served hubs.
function nearest2(codes) {
  const out = [];
  const seen = new Set();
  codes.forEach((a) => {
    const near = codes
      .filter((b) => b !== a)
      .map((b) => {
        const dx = POS[a][0] - POS[b][0];
        const dy = POS[a][1] - POS[b][1];
        return [dx * dx + dy * dy, b];
      })
      .sort((p, q) => p[0] - q[0]);
    for (let k = 0; k < 2; k += 1) {
      const b = near[k][1];
      const key = a < b ? `${a}~${b}` : `${b}~${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({a, b, kind: 'net'});
    }
  });
  return out;
}
const NET_EDGES = nearest2(SERVED_CODES);
// the chain up to Quechua, and the cluster behind it
const CHAIN_EDGES = [
  {a: 'fao', b: 'dan', kind: 'chain', tier0: 'ok'},
  {a: 'dan', b: 'spa', kind: 'chain', tier0: 'good'},
  {a: 'spa', b: 'que', kind: 'chain', tier0: 'ok', improves: 1}, // the bridge that goes green
];
const CLUSTER_EDGES = CLUSTER_CODES.map((c) => ({a: 'que', b: c, kind: 'cluster', tier0: 'ok'}));
const ALL_EDGES = [...NET_EDGES, ...CHAIN_EDGES, ...CLUSTER_EDGES];
const domKey = (a, b) => (a < b ? `${a}~${b}` : `${b}~${a}`);
// deterministic tier for a net edge (the served network is mostly good/ok)
const netTier = (i) => (i % 4 === 0 ? 'ok' : 'good');

// A batch of "finished pairs" the queue emits back into the network — extra
// links that fill the field in (drawn from anon dots near served hubs).
// The zipper (the queue) lives on the far-right edge; 7 tooth-rows.
const ZIP_X = 602;
const ZIP_ROWS = Array.from({length: 7}, (_, i) => ({y: 70 + i * 30}));
const INTAKE_X = ZIP_X - 46;

// Finished pairs the queue emits back into the network — three batches (one per
// queue cycle) so the field FILLS IN progressively. Each lands as a short local
// edge: a served hub → its nearest not-yet-used field dot.
const _usedFill = new Set();
function fillBatch(seed, count) {
  const r = mulberry32(seed);
  const out = [];
  let guard = 0;
  while (out.length < count && guard < 300) {
    guard += 1;
    const hub = SERVED_CODES[Math.floor(r() * SERVED_CODES.length)];
    let best = null;
    let bd = Infinity;
    ANON.forEach((a, ai) => {
      if (_usedFill.has(ai)) return;
      const dx = a.x - POS[hub][0];
      const dy = a.y - POS[hub][1];
      const d = dx * dx + dy * dy;
      if (d > 60 && d < bd) { bd = d; best = {a, ai}; }
    });
    if (best) { _usedFill.add(best.ai); out.push({from: POS[hub], to: [best.a.x, best.a.y], tier: r() < 0.5 ? 'good' : 'ok'}); }
  }
  return out;
}
const FILL_BATCHES = [fillBatch(11, 6), fillBatch(23, 6), fillBatch(41, 6)];
const FILL_ALL = FILL_BATCHES.flat();

// Corpora entering the queue each cycle — field dots that fly IN to the zipper.
const INTAKE_SRC = [0, 1, 2].map((c) => {
  const r = mulberry32(100 + c);
  return Array.from({length: 6}, () => {
    const a = ANON[Math.floor(r() * ANON.length)];
    return [a.x, a.y];
  });
});

function splitWords(seg, cls) {
  const text = seg.getAttribute('data-text') || seg.textContent;
  seg.setAttribute('data-text', text);
  seg.textContent = '';
  const out = [];
  text.split(/\s+/).filter(Boolean).forEach((w, i, arr) => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = w;
    seg.appendChild(s);
    if (i < arr.length - 1) seg.appendChild(document.createTextNode(' '));
    out.push(s);
  });
  return out;
}

export default function SeamStudio() {
  const [reduced, setReduced] = useState(false);

  const aStage = useRef(null);
  const aSvg = useRef(null);
  const aScrub = useRef(null);
  const aPlay = useRef(null);
  const aLabel = useRef(null);

  const nSvg = useRef(null);
  const nScrub = useRef(null);
  const nPlay = useRef(null);
  const nLabel = useRef(null);

  useEffect(() => {
    const rm =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (rm) {
      setReduced(true);
      return undefined;
    }

    let mounted = true;
    let gsap;
    const handles = {};
    const perpetual = [];

    const wire = (tl, scrub, play, label, beats) => {
      tl.pause(0);
      tl.eventCallback('onUpdate', () => {
        const p = tl.progress();
        if (scrub) scrub.value = String(Math.round(p * 1000));
        if (label && beats) {
          const b = beats.find((x) => p <= x.end) || beats[beats.length - 1];
          label.textContent = b ? b.name : '';
        }
      });
      if (scrub) {
        scrub.addEventListener('input', () => {
          tl.pause();
          tl.progress(Number(scrub.value) / 1000);
        });
      }
      if (play) {
        play.addEventListener('click', () => {
          if (tl.progress() >= 0.999) tl.progress(0);
          tl.play();
        });
      }
    };

    (async () => {
      const mod = await import('gsap');
      if (!mounted) return;
      gsap = mod.gsap || mod.default;

      /* ============ POC A — pacing + lock-and-pop dwell ============ */
      try {
        const svg = aSvg.current;
        const dots = Array.from(svg.querySelectorAll('[data-dot]'));
        const covered = dots.filter((d) => d.getAttribute('data-cov') === '1');
        const uncovered = dots
          .filter((d) => d.getAttribute('data-cov') !== '1')
          .sort((p, q) => Number(p.getAttribute('data-x')) - Number(q.getAttribute('data-x')));
        const lines = Array.from(aStage.current.querySelectorAll(`.${styles.msgLine}`));

        gsap.set(dots, {opacity: 0});
        const tl = gsap.timeline();
        const HOLD = 1.2;
        tl.set(lines, {autoAlpha: 0}, 0);
        tl.to(dots, {opacity: 0.7, duration: 0.6, stagger: {each: 0.003, from: 'random'}}, 0);

        const revealLine = (line, at, tone, onPop) => {
          tl.set(line, {autoAlpha: 1}, at);
          const pop = line.querySelector(`.${styles.pop}`);
          if (pop) pop.style.color = tone.hex;
          let words = [];
          line.querySelectorAll('[data-text]').forEach((seg) => {
            words = words.concat(splitWords(seg, styles.word));
          });
          const evens = words.filter((_, i) => i % 2 === 0);
          const odds = words.filter((_, i) => i % 2 === 1);
          const to = {yPercent: 0, opacity: 1, duration: 0.34, ease: 'back.out(1.7)'};
          if (evens.length) tl.fromTo(evens, {yPercent: -55, opacity: 0}, {...to, stagger: 0.04}, at);
          if (odds.length) tl.fromTo(odds, {yPercent: 55, opacity: 0}, {...to, stagger: 0.04}, at);
          let cur = at + Math.max(evens.length, odds.length) * 0.04 + 0.36;
          if (pop) {
            const end = addLockPop(gsap, tl, pop, cur, {rgb: tone.rgb, chargeDur: 0.12, popDur: 0.1, settleDur: 0.36, breathe: false});
            if (onPop) onPop(cur + 0.24);
            cur = Math.max(end, cur);
          }
          cur += HOLD;
          tl.to(line, {autoAlpha: 0, duration: 0.35}, cur);
          return cur + 0.35;
        };

        const starts = [];
        let at = 0.7;
        const white = {hex: NEUTRAL.text, rgb: BRAND.teal.rgb};
        starts.push(at);
        at = revealLine(lines[0], at, white);
        starts.push(at);
        at = revealLine(lines[1], at, QUALITY.good, (t) => {
          tl.to(covered, {fill: QUALITY.good.hex, opacity: 1, duration: 0.3, stagger: 0.02, ease: 'back.out(2)'}, t);
        });
        starts.push(at);
        at = revealLine(lines[2], at, QUALITY.bad, (t) => {
          tl.to(uncovered, {fill: QUALITY.bad.hex, opacity: 0.92, duration: 0.5, stagger: {each: 0.004, from: 'start'}}, t);
        });

        const dur = tl.duration();
        const beats = [
          {end: starts[1] / dur, name: 'more than 7,000'},
          {end: starts[2] / dur, name: 'only 552 covered'},
          {end: 1, name: 'a billion cannot'},
        ];
        wire(tl, aScrub.current, aPlay.current, aLabel.current, beats);
        handles.a = tl;
        tl.play();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[seam-studio] POC A build failed', e);
      }

      /* ============ POC B — the living network (queue builds it) ============ */
      try {
        const svg = nSvg.current;
        const dots = Array.from(svg.querySelectorAll('[data-fdot]'));
        const served = Array.from(svg.querySelectorAll('[data-served="1"]'));
        const edge = (a, b) => svg.querySelector(`[data-e="${domKey(a, b)}"]`);
        const node = (c) => svg.querySelector(`[data-nn="${c}"]`);
        const zipConns = Array.from(svg.querySelectorAll('[data-zip]'));
        const zipTeeth = Array.from(svg.querySelectorAll('[data-tooth]'));
        const fillEdges = Array.from(svg.querySelectorAll('[data-filledge]'));
        const packets = Array.from(svg.querySelectorAll('[data-packet]'));

        // initial states — the field starts FAINT (the backdrop we zoom into)
        gsap.set(dots, {opacity: (i, el) => (Number(el.getAttribute('cx')) > 560 ? 0.08 : 0.22)});
        gsap.set([...svg.querySelectorAll('[data-e]')], {opacity: 0});
        gsap.set(svg.querySelectorAll('[data-cluster="1"]'), {opacity: 0});
        gsap.set([...zipConns, ...zipTeeth], {opacity: 0});
        gsap.set([...fillEdges, ...packets], {opacity: 0});

        const tl = gsap.timeline();

        // — CAMERA: start pulled back on the wide backdrop, zoom into the section
        //   to build it, then pull back out at the end (scrub-safe) —
        const cam = svg.querySelector('[data-cam]');
        if (cam) {
          gsap.set(cam, {svgOrigin: '320 180', scale: 0.84, opacity: 0.6});
          tl.to(cam, {opacity: 0.82, duration: 0.5}, 0); // the backdrop holds a beat
          tl.to(cam, {scale: 1, opacity: 1, duration: 1.3, ease: 'power2.out'}, 0.5); // zoom into the section
        }

        // — BEAT 0: the field (same dots as POC A) — served ones glow green;
        //   dots behind the queue (far right) stay dim so the queue reads clean —
        const fieldOpacity = (i, el) => {
          if (el.getAttribute('data-served') === '1') return 1;
          return Number(el.getAttribute('cx')) > 560 ? 0.12 : 0.5;
        };
        tl.to(dots, {opacity: fieldOpacity, duration: 0.6, stagger: {each: 0.003, from: 'center'}}, 0);
        served.forEach((el) => {
          const st = dotStyle('good', el.getAttribute('data-hub') === '1' ? 'lg' : 'md');
          tl.to(el, {fill: QUALITY.good.hex, duration: 0.3}, 0.4);
        });
        const b0End = 1.4;

        // — BEAT 1: the network forms between the green dots —
        let e1 = b0End;
        NET_EDGES.forEach((ed, i) => {
          const el = edge(ed.a, ed.b);
          if (!el) return;
          const s = edgeStyle(netTier(i));
          const len = el.getTotalLength ? el.getTotalLength() : 120;
          gsap.set(el, {strokeDasharray: len, strokeDashoffset: len});
          tl.to(el, {strokeDashoffset: 0, opacity: 0.85, stroke: s.stroke, strokeWidth: s.strokeWidth, duration: 0.3}, e1 + i * 0.03);
        });
        // the network lands (lock-and-pop a hub) then holds a beat
        const netFormed = e1 + NET_EDGES.length * 0.03 + 0.3;
        if (node('eng')) addLockPop(gsap, tl, node('eng'), netFormed, {rgb: QUALITY.good.rgb, chargeDur: 0.12, popDur: 0.1, settleDur: 0.34, breathe: false});
        const b1End = netFormed + 1.2;

        // — BEAT 2 & 3: the QUEUE — a continuously-running pipeline on the right.
        //   Corpora fly IN from the field → the zipper zips (tested) → finished
        //   pairs fly OUT to fill in and strengthen the network. Three cycles.
        const intakeDots = Array.from(svg.querySelectorAll('[data-intake]'));
        const rail = svg.querySelector('[data-rail]');
        const slider = svg.querySelector('[data-slider]');
        const zlabel = svg.querySelector('[data-zlabel]');
        gsap.set([...intakeDots, slider, rail, zlabel], {opacity: 0});

        const zAt = b1End;
        const topY = ZIP_ROWS[0].y;
        const botY = ZIP_ROWS[ZIP_ROWS.length - 1].y;
        // the queue slides in on the right (rail + label + teeth settle)
        tl.to(rail, {opacity: 0.5, duration: 0.3}, zAt);
        tl.to(zlabel, {opacity: 0.85, duration: 0.3}, zAt);
        if (zlabel) addLockPop(gsap, tl, zlabel, zAt + 0.3, {rgb: BRAND.teal.rgb, chargeDur: 0.12, popDur: 0.1, settleDur: 0.34, breathe: false});
        tl.to(zipTeeth, {opacity: 1, duration: 0.3, stagger: 0.02}, zAt);

        const queueCycle = (at, bi) => {
          const src = INTAKE_SRC[bi];
          // 1) corpora fly IN from the field to the intake column
          intakeDots.forEach((el, i) => {
            const s = src[i] || src[0];
            tl.set(el, {attr: {cx: s[0], cy: s[1]}, opacity: 0}, at);
            tl.to(el, {opacity: 0.9, duration: 0.1}, at + i * 0.03);
            tl.to(el, {attr: {cx: INTAKE_X, cy: ZIP_ROWS[i].y}, duration: 0.4, ease: 'power2.inOut'}, at + i * 0.03);
          });
          const arrive = at + 0.55;
          // 2) the zip: a slider runs the rail, connectors light top→down
          tl.set(slider, {attr: {cx: ZIP_X, cy: topY}, opacity: 1}, arrive);
          tl.to(slider, {attr: {cy: botY}, duration: 0.55, ease: 'none'}, arrive);
          zipConns.forEach((el, i) => {
            const tier = i % 3 === 0 ? 'ok' : 'good';
            tl.fromTo(el, {scaleY: 0, transformOrigin: '50% 0%'}, {scaleY: 1, opacity: 1, stroke: hexForTier(tier), duration: 0.12}, arrive + i * 0.07);
          });
          tl.to(intakeDots, {opacity: 0, duration: 0.2}, arrive + 0.3); // consumed
          tl.to(slider, {opacity: 0, duration: 0.15}, arrive + 0.62);
          const zipped = arrive + zipConns.length * 0.07 + 0.2;
          // 3) finished pairs travel OUT as PACKETS; each lands and draws a new
          //    edge (hub → a nearby dot), growing/strengthening the network.
          const batch = FILL_ALL.slice(bi * 6, bi * 6 + 6);
          let out = zipped;
          batch.forEach((t, gi) => {
            const pk = packets[gi];
            const fe = fillEdges[bi * 6 + gi];
            const startY = ZIP_ROWS[gi % ZIP_ROWS.length].y;
            const pAt = zipped + gi * 0.08;
            if (pk) {
              gsap.set(pk, {attr: {cx: ZIP_X, cy: startY, r: 3}, opacity: 0, fill: hexForTier(t.tier)});
              tl.to(pk, {opacity: 1, duration: 0.06}, pAt);
              tl.to(pk, {attr: {cx: t.to[0], cy: t.to[1]}, duration: 0.42, ease: 'power2.inOut'}, pAt);
              tl.to(pk, {opacity: 0, duration: 0.12}, pAt + 0.42);
            }
            if (fe) {
              const len = fe.getTotalLength ? fe.getTotalLength() : 40;
              gsap.set(fe, {strokeDasharray: len, strokeDashoffset: len, stroke: hexForTier(t.tier), opacity: 0});
              tl.to(fe, {strokeDashoffset: 0, opacity: 0.85, duration: 0.24}, pAt + 0.36);
            }
            const d = svg.querySelector(`[data-anonxy="${Math.round(t.to[0])},${Math.round(t.to[1])}"]`);
            if (d) tl.to(d, {fill: t.tier === 'good' ? QUALITY.good.hex : QUALITY.ok.hex, opacity: 1, duration: 0.25}, pAt + 0.4);
            out = pAt + 0.54;
          });
          return out + 0.2;
        };

        let qAt = zAt + 0.6;
        qAt = queueCycle(qAt, 0);
        // a better run lifts two existing edges (strengthen, not just fill)
        [NET_EDGES[1], NET_EDGES[5]].forEach((ed, i) => {
          const el = ed && edge(ed.a, ed.b);
          if (el) edgeRecolor(gsap, tl, el, qAt - 0.3 + i * 0.2, {from: 'ok', to: 'good', stepDur: 0.2});
        });
        qAt = queueCycle(qAt, 1);
        qAt = queueCycle(qAt, 2);
        const b3End = qAt + 0.6;

        // — BEAT 4 (basic this iteration): the chain up to Quechua, cluster dim —
        const cAt = b3End;
        tl.to(svg.querySelectorAll('[data-cluster="1"]'), {opacity: 0.25, duration: 0.4}, cAt);
        [...CHAIN_EDGES].forEach((ed, i) => {
          const el = edge(ed.a, ed.b);
          if (!el) return;
          const len = el.getTotalLength ? el.getTotalLength() : 120;
          gsap.set(el, {strokeDasharray: len, strokeDashoffset: len});
          tl.to(el, {strokeDashoffset: 0, opacity: 1, stroke: hexForTier(ed.tier0), strokeWidth: 2.6, duration: 0.28}, cAt + i * 0.18);
        });
        CLUSTER_EDGES.forEach((ed, i) => {
          const el = edge(ed.a, ed.b);
          if (!el) return;
          tl.to(el, {opacity: 0.35, stroke: hexForTier('ok'), strokeWidth: 1.6, duration: 0.3}, cAt + 0.6 + i * 0.03);
        });
        const chainEnd = cAt + 1.2;

        // — the bridge goes green → the cluster OPENS UP —
        const oAt = chainEnd;
        const spaQue = edge('spa', 'que');
        if (spaQue) edgeRecolor(gsap, tl, spaQue, oAt, {from: 'ok', to: 'good', stepDur: 0.26});
        if (node('que')) addLockPop(gsap, tl, node('que'), oAt + 0.5, {rgb: QUALITY.good.rgb, chargeDur: 0.12, popDur: 0.1, settleDur: 0.34, breathe: false});
        CLUSTER_EDGES.forEach((ed, i) => {
          const el = edge(ed.a, ed.b);
          if (el) tl.to(el, {opacity: 0.95, strokeWidth: 2.4, filter: glowForTier('ok', 5, 0.6), duration: 0.3}, oAt + 0.6 + i * 0.05);
          const cd = node(ed.b);
          if (cd) tl.to(cd, {fill: QUALITY.ok.hex, opacity: 1, duration: 0.3}, oAt + 0.65 + i * 0.05);
        });
        // a request now flows the whole chain and into the cluster — the path opens
        const tracePts = ['fao', 'dan', 'spa', 'que', 'aym'].map((c) => ({x: POS[c][0], y: POS[c][1]}));
        if (packets[0]) routeTrace(gsap, tl, packets[0], tracePts, oAt + 0.4, {segDur: 0.26, tone: 'good'});
        const b4End = oAt + 2.2;

        // — settle (the queue keeps running), then pull back to the backdrop —
        tl.to(dots, {opacity: fieldOpacity, duration: 1.0}, '>');
        if (cam) tl.to(cam, {scale: 0.84, opacity: 0.75, duration: 1.3, ease: 'power2.inOut'}, '>');

        const dur = tl.duration();
        const beats = [
          {end: b1End / dur, name: 'the network forms'},
          {end: b3End / dur, name: 'the queue builds it'},
          {end: 1, name: 'a bridge opens a cluster'},
        ];
        wire(tl, nScrub.current, nPlay.current, nLabel.current, beats);
        handles.n = tl;
        tl.play();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[seam-studio] POC B build failed', e);
      }

      if (typeof window !== 'undefined') window.__STUDIO = {gsap, ...handles};
    })();

    return () => {
      mounted = false;
      perpetual.forEach((t) => t && t.kill());
      if (gsap) gsap.killTweensOf('*');
    };
  }, []);

  const labelDx = (n) => (n.x > VW * 0.62 ? -7 : 7);
  const labelAnchor = (n) => (n.x > VW * 0.62 ? 'end' : 'start');

  return (
    <Layout title="Seam studio — proofs" description="Living-network seam POCs (unlinked)." noFooter>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.main}>
        <div className={styles.inner}>
          <header className={styles.pageHead}>
            <p className={styles.kicker}>Living-network seam · Stage 1 proofs</p>
            <h1 className={styles.title}>Seam studio</h1>
            <p className={styles.sub}>
              The same dots are the problem field (A) and the network's nodes (B). The network
              forms between the served (green) dots; a continuous queue — corpora, tested pair by
              pair — runs on the right and keeps feeding it. Nothing here touches the homepage.
            </p>
          </header>

          {reduced && (
            <p className={styles.sub} style={{marginBottom: '2rem', color: '#e8843a'}}>
              Reduced-motion is on, so the animated proofs are paused.
            </p>
          )}

          {/* ============ POC A ============ */}
          <section className={styles.poc}>
            <div className={styles.pocHead}>
              <span className={styles.pocTag}>A</span>
              <h2 className={styles.pocTitle}>Pacing &amp; lock-and-pop dwell</h2>
              <p className={styles.pocNote}>
                Beats POP then STICK. Dots colour as the story turns — white → 552 green → a
                billion red. These same dots become the network in B.
              </p>
            </div>
            <div className={styles.stage} ref={aStage}>
              <svg className={styles.stageSvg} viewBox={`0 0 ${VW} ${VH}`} ref={aSvg} aria-hidden="true">
                {ANON.map((d, i) => (
                  <circle key={`a${i}`} data-dot="" data-x={d.x} cx={d.x} cy={d.y} r={1.7} fill={NEUTRAL.text} opacity="0" />
                ))}
                {NAMED.map((n) => (
                  <circle key={n.code} data-dot="" data-cov={n.served ? '1' : '0'} data-x={n.x} cx={n.x} cy={n.y} r={n.served ? (n.hub ? 3 : 2.4) : 2} fill={NEUTRAL.text} opacity="0" />
                ))}
              </svg>
              <div className={styles.messages}>
                <p className={styles.msgLine}>
                  <span data-text="There are more than">There are more than</span>{' '}
                  <span className={styles.pop} data-text="7,000">7,000</span>{' '}
                  <span data-text="living languages today.">living languages today.</span>
                </p>
                <p className={styles.msgLine}>
                  <span data-text="Only">Only</span>{' '}
                  <span className={styles.pop} data-text="552">552</span>{' '}
                  <span data-text="are covered by machine translation.">are covered by machine translation.</span>
                </p>
                <p className={styles.msgLine}>
                  <span data-text="More than a billion people">More than a billion people</span>{' '}
                  <span className={styles.pop} data-text="cannot translate">cannot translate</span>{' '}
                  <span data-text="into their first language.">into their first language.</span>
                </p>
              </div>
              <span className={styles.stageTag}>problem field — dots = living languages</span>
            </div>
            <div className={styles.controls}>
              <button type="button" className={styles.playBtn} ref={aPlay}>play</button>
              <input type="range" min="0" max="1000" defaultValue="0" className={styles.scrub} ref={aScrub} aria-label="scrub POC A" />
              <span className={styles.beatLabel} ref={aLabel} />
            </div>
          </section>

          {/* ============ POC B — the living network ============ */}
          <section className={styles.poc}>
            <div className={styles.pocHead}>
              <span className={styles.pocTag}>B</span>
              <h2 className={styles.pocTitle}>The living network — the queue builds it</h2>
              <p className={styles.pocNote}>
                The same dots are the nodes. The network forms between the served (green) dots;
                the queue (a zipper — corpora built, tested pair by pair) runs on the right and
                keeps feeding finished pairs back to fill in and strengthen it. Then a low-resource
                bridge (Spanish↔Quechua) goes green and a whole cluster of paths opens up.
              </p>
            </div>
            <div className={styles.stage}>
              <svg className={styles.stageSvg} viewBox={`0 0 ${VW} ${VH}`} ref={nSvg} aria-hidden="true">
                <g data-cam="">
                {/* edges (network + chain + cluster) */}
                {NET_EDGES.map((ed, i) => (
                  <line key={`ne${i}`} data-e={domKey(ed.a, ed.b)} x1={POS[ed.a][0]} y1={POS[ed.a][1]} x2={POS[ed.b][0]} y2={POS[ed.b][1]} stroke={SLATE} strokeWidth="1.2" opacity="0" />
                ))}
                {CHAIN_EDGES.map((ed, i) => (
                  <line key={`ce${i}`} data-e={domKey(ed.a, ed.b)} x1={POS[ed.a][0]} y1={POS[ed.a][1]} x2={POS[ed.b][0]} y2={POS[ed.b][1]} stroke={SLATE} strokeWidth="1.4" opacity="0" />
                ))}
                {CLUSTER_EDGES.map((ed, i) => (
                  <line key={`cl${i}`} data-e={domKey(ed.a, ed.b)} data-cluster="1" x1={POS[ed.a][0]} y1={POS[ed.a][1]} x2={POS[ed.b][0]} y2={POS[ed.b][1]} stroke={SLATE} strokeWidth="1.2" opacity="0" />
                ))}
                {/* new edges the queue produces (hub → a nearby dot), drawn on packet arrival */}
                {FILL_ALL.map((t, i) => (
                  <line key={`fe${i}`} data-filledge="" x1={t.from[0]} y1={t.from[1]} x2={t.to[0]} y2={t.to[1]} stroke={QUALITY.good.hex} strokeWidth="1.8" strokeLinecap="round" opacity="0" />
                ))}
                {/* packets carrying finished pairs from the queue into the network */}
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <circle key={`pk${i}`} data-packet="" cx={ZIP_X} cy={ZIP_ROWS[i].y} r="3" fill={QUALITY.good.hex} opacity="0" />
                ))}
                {/* the shared dot field */}
                {ANON.map((d, i) => (
                  <circle key={`fa${i}`} data-fdot="" data-anonxy={`${Math.round(d.x)},${Math.round(d.y)}`} cx={d.x} cy={d.y} r={1.7} fill={NEUTRAL.text} opacity="0" />
                ))}
                {NAMED.map((n) => (
                  <g key={n.code} data-nn={n.code}>
                    <circle data-fdot="" data-served={n.served ? '1' : '0'} data-hub={n.hub ? '1' : '0'} cx={n.x} cy={n.y} r={n.served ? (n.hub ? 3.2 : 2.4) : 2.2} fill={n.served ? QUALITY.good.hex : NEUTRAL.text} opacity="0" />
                    {n.label ? (
                      <text x={n.x + labelDx(n)} y={n.y + 3.4} textAnchor={labelAnchor(n)} fontSize="9.5" fill="#c8d0de">{n.label}</text>
                    ) : null}
                  </g>
                ))}
                {/* the queue (zipper) on the right — a running pipeline */}
                <line data-rail="" x1={ZIP_X} y1={ZIP_ROWS[0].y - 16} x2={ZIP_X} y2={ZIP_ROWS[ZIP_ROWS.length - 1].y + 16} stroke={SLATE} strokeWidth="0.8" opacity="0" />
                <text data-zlabel="" x={ZIP_X} y={ZIP_ROWS[0].y - 24} textAnchor="middle" fontSize="9" fill="#8b95a7" opacity="0">the queue</text>
                {ZIP_ROWS.map((r, i) => (
                  <g key={`z${i}`}>
                    <circle data-tooth="" cx={ZIP_X - 18} cy={r.y} r="3.2" fill="#dfe6f2" opacity="0" />
                    <circle data-tooth="" cx={ZIP_X + 18} cy={r.y} r="3.2" fill="#dfe6f2" opacity="0" />
                    <line data-zip="" x1={ZIP_X - 18} y1={r.y} x2={ZIP_X + 18} y2={r.y} stroke={SLATE} strokeWidth="3" strokeLinecap="round" opacity="0" />
                  </g>
                ))}
                {/* corpora that fly IN to the queue each cycle */}
                {ZIP_ROWS.slice(0, 6).map((r, i) => (
                  <circle key={`in${i}`} data-intake="" cx={INTAKE_X} cy={r.y} r="2.2" fill="#cdd6e4" opacity="0" />
                ))}
                {/* the zip slider */}
                <circle data-slider="" cx={ZIP_X} cy={ZIP_ROWS[0].y} r="5" fill={BRAND.teal.hex} opacity="0" />
                </g>
              </svg>
              <span className={styles.stageTag}>communities build corpora → the queue → the network</span>
            </div>
            <div className={styles.controls}>
              <button type="button" className={styles.playBtn} ref={nPlay}>play</button>
              <input type="range" min="0" max="1000" defaultValue="0" className={styles.scrub} ref={nScrub} aria-label="scrub POC B" />
              <span className={styles.beatLabel} ref={nLabel} />
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
