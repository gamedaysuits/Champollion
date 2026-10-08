import React, {useEffect, useRef, useState} from 'react';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import {addLockPop} from '../utils/lockPop.mjs';
import styles from './color-lab.module.css';

/**
 * /color-lab — the BRAND COLOR STANDARD, shown LIVE and IN CONTEXT.
 * Unlinked, noindex.
 *
 * A seam-style stage that LOOPS: the glowing dot field (correct red-majority
 * ratio), the message lines revealing word-by-word and locking-and-popping in
 * each brand color, and the network drawing in with its pulse. Shade pickers
 * recolor the whole stage live so the exact orange / green / red can be chosen.
 */

const OPTIONS = {
  green: [
    {id: 'g1', name: '★ brand teal', hex: '#3fc1c0', rgb: '63, 193, 192'},
    {id: 'g2', name: 'leaf', hex: '#4caf50', rgb: '76, 175, 80'},
    {id: 'g3', name: 'bright', hex: '#66bb6a', rgb: '102, 187, 106'},
  ],
  red: [
    {id: 'r1', name: '★ ember', hex: '#e0503a', rgb: '224, 80, 58'},
    {id: 'r2', name: 'signal', hex: '#d64550', rgb: '214, 69, 80'},
    {id: 'r3', name: 'deep', hex: '#c0392b', rgb: '192, 57, 43'},
  ],
  orange: [
    {id: 'o1', name: '★ vitality', hex: '#e0763a', rgb: '224, 118, 58'},
    {id: 'o2', name: 'warm', hex: '#e07b46', rgb: '224, 123, 70'},
    {id: 'o3', name: 'gold', hex: '#e8b339', rgb: '232, 179, 57'},
  ],
};

// Deterministic field scatter (~8% covered → the true 552-of-7,077 ratio).
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const frand = mulberry32(424242);
const FIELD = Array.from({length: 240}, () => ({
  x: 8 + frand() * 584,
  y: 8 + frand() * 224,
  covered: frand() < 0.085,
}));

// Small network (slate + one orange chain) for the network stage.
const nrand = mulberry32(99);
const NODES = Array.from({length: 26}, () => [30 + nrand() * 540, 20 + nrand() * 200]);
NODES[0] = [80, 60];
NODES[1] = [210, 120];
NODES[2] = [370, 90];
NODES[3] = [520, 170];
const ARCS = [];
{
  const seen = new Set();
  const chain = new Set(['0-1', '1-2', '2-3']);
  for (let i = 0; i < NODES.length; i += 1) {
    const near = [];
    for (let j = 0; j < NODES.length; j += 1) {
      if (j === i) continue;
      const dx = NODES[i][0] - NODES[j][0];
      const dy = NODES[i][1] - NODES[j][1];
      near.push([dx * dx + dy * dy, j]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 2; k += 1) {
      const j = near[k][1];
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ARCS.push({a: i, b: j, chain: chain.has(key)});
    }
  }
  ['0-1', '1-2', '2-3'].forEach((key) => {
    if (!seen.has(key)) {
      const [a, b] = key.split('-').map(Number);
      ARCS.push({a, b, chain: true});
    }
  });
}
const arcPath = (a, b) =>
  `M${a[0]},${a[1]} Q${(a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.18},${(a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.18} ${b[0]},${b[1]}`;

function splitWords(span, cls) {
  const text = span.getAttribute('data-text') || span.textContent;
  span.setAttribute('data-text', text);
  span.textContent = '';
  const words = text.split(/\s+/).filter(Boolean);
  return words.map((w, i) => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = w;
    span.appendChild(s);
    if (i < words.length - 1) span.appendChild(document.createTextNode(' '));
    return s;
  });
}

export default function ColorLab() {
  const [green, setGreen] = useState(OPTIONS.green[0]);
  const [red, setRed] = useState(OPTIONS.red[0]);
  const [orange, setOrange] = useState(OPTIONS.orange[0]);

  const gsapRef = useRef(null);
  const colorsRef = useRef({green, red, orange});
  useEffect(() => {
    colorsRef.current = {green, red, orange};
  }, [green, red, orange]);

  const stageRef = useRef(null);
  const netRef = useRef(null);
  const pulseRef = useRef(null);
  const playRef = useRef(() => {});

  useEffect(() => {
    let mounted = true;
    let timer = null;
    (async () => {
      const mod = await import('gsap');
      if (!mounted) return;
      const gsap = mod.gsap || mod.default;
      gsapRef.current = gsap;
      // dev handle: force-render frames in preview panes that pause rAF
      if (typeof window !== 'undefined') window.__CL = {gsap};

      const lineEls = () => stageRef.current.querySelectorAll(`.${styles.msgLine}`);

      const playOnce = () => {
        if (!stageRef.current) return;
        const {green: g, red: r, orange: o} = colorsRef.current;
        const toneFor = (el) => {
          const t = el.getAttribute('data-tone');
          if (t === 'green') return g;
          if (t === 'red') return r;
          if (t === 'orange') return o;
          return {hex: '#e6e9e7', rgb: '230, 233, 231'};
        };
        gsap.killTweensOf('*');
        const tl = gsap.timeline();
        let at = 0;
        lineEls().forEach((line) => {
          gsap.set(line, {autoAlpha: 1});
          const phrase = line.querySelector(`.${styles.pop}`);
          const tone = toneFor(phrase || line);
          if (phrase) phrase.style.color = tone.hex;
          let words = [];
          line.querySelectorAll('[data-text]').forEach((seg) => {
            words = words.concat(splitWords(seg, styles.word));
          });
          const evens = words.filter((_, i) => i % 2 === 0);
          const odds = words.filter((_, i) => i % 2 === 1);
          const to = {yPercent: 0, opacity: 1, duration: 0.32, ease: 'back.out(1.7)'};
          if (evens.length) tl.fromTo(evens, {yPercent: -55, opacity: 0}, {...to, stagger: 0.045}, at);
          if (odds.length) tl.fromTo(odds, {yPercent: 55, opacity: 0}, {...to, stagger: 0.045}, at);
          at += Math.max(evens.length, odds.length) * 0.045 + 0.34;
          if (phrase) {
            addLockPop(gsap, tl, phrase, at, {rgb: tone.rgb, chargeDur: 0.1, popDur: 0.09, settleDur: 0.34, breathe: false});
            at += 0.5;
          }
          at += 0.35;
        });
        // network draw + pulse (in the same loop)
        if (netRef.current) {
          const arcs = netRef.current.querySelectorAll(`.${styles.netArc}`);
          tl.fromTo(arcs, {strokeDashoffset: 200, opacity: 0}, {strokeDashoffset: 0, opacity: (i, el) => (el.classList.contains(styles.netArcChain) ? 0.95 : 0.3), duration: 0.5, stagger: 0.01}, 0.2);
        }
        if (pulseRef.current) {
          tl.fromTo(pulseRef.current, {strokeDashoffset: 520, opacity: 1}, {strokeDashoffset: 0, duration: 0.7, ease: 'none'}, at - 0.4);
        }
        // hold, then fade the text out so the loop reads as a fresh telling
        tl.to(lineEls(), {autoAlpha: 0, duration: 0.3}, at + 1.4);
        return tl;
      };

      playRef.current = playOnce;
      playOnce();
      timer = setInterval(() => playOnce(), 8500);
    })();
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      if (gsapRef.current) gsapRef.current.killTweensOf('*');
    };
  }, []);

  const pick = (setter) => (opt) => {
    setter(opt);
    // recolor + replay immediately so the new color is seen at once
    setTimeout(() => playRef.current && playRef.current(), 30);
  };

  const Picker = ({label, opts, value, onPick}) => (
    <div className={styles.pickRow}>
      <span className={styles.pickLabel}>{label}</span>
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          className={clsxSel(styles.chip, value.id === o.id && styles.chipOn)}
          style={{'--chip': o.hex}}
          onClick={() => onPick(o)}>
          <span className={styles.chipDot} style={{background: o.hex}} />
          {o.name} <b className={styles.chipHex}>{o.hex}</b>
        </button>
      ))}
    </div>
  );

  return (
    <Layout title="Color standard — live" description="Live in-context brand color-standard picker." noFooter>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <svg width="0" height="0" style={{position: 'absolute'}} aria-hidden="true">
        <defs>
          <filter id="cl-glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
          <filter id="cl-glow-soft" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>
      </svg>

      <main className={styles.main}>
        <div className={styles.inner}>
          <header className={styles.pageHead}>
            <p className={styles.kicker}>Brand color standard · live</p>
            <h1 className={styles.title}>The effects, in context</h1>
            <p className={styles.sub}>
              The seam&apos;s moments, looping in the on-brand colors. Use the pickers to
              swap any shade and watch the whole stage recolor. ★ = the hero map&apos;s
              current value.
            </p>
          </header>

          <div className={styles.pickers}>
            <Picker label="green" opts={OPTIONS.green} value={green} onPick={pick(setGreen)} />
            <Picker label="red" opts={OPTIONS.red} value={red} onPick={pick(setRed)} />
            <Picker label="orange" opts={OPTIONS.orange} value={orange} onPick={pick(setOrange)} />
          </div>

          {/* STAGE A — the field + the message (looping) */}
          <div className={styles.stage} ref={stageRef}>
            <svg className={styles.stageField} viewBox="0 0 600 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              {FIELD.map((d, i) =>
                d.covered ? (
                  <g key={i}>
                    <circle cx={d.x} cy={d.y} r={5} fill={green.hex} opacity="0.5" filter="url(#cl-glow)" />
                    <circle cx={d.x} cy={d.y} r={1.6} fill="#fff" opacity="0.95" />
                  </g>
                ) : (
                  <circle key={i} cx={d.x} cy={d.y} r={2.3} fill={red.hex} opacity="0.55" filter="url(#cl-glow-soft)" />
                ),
              )}
            </svg>
            <div className={styles.messages}>
              <p className={styles.msgLine}>
                <span data-text="There are more than">There are more than</span>{' '}
                <span className={styles.pop} data-tone="none" data-text="7,000 living spoken languages">7,000 living spoken languages</span>{' '}
                <span data-text="today.">today.</span>
              </p>
              <p className={styles.msgLine}>
                <span data-text="Only">Only</span>{' '}
                <span className={styles.pop} data-tone="green" data-text="552">552</span>{' '}
                <span data-text="are covered.">are covered.</span>
              </p>
              <p className={styles.msgLine}>
                <span data-text="A billion people">A billion people</span>{' '}
                <span className={styles.pop} data-tone="red" data-text="cannot translate">cannot translate</span>{' '}
                <span data-text="into their first language.">into their first language.</span>
              </p>
              <p className={styles.msgLine}>
                <span data-text="The dominant answer is one">The dominant answer is one</span>{' '}
                <span className={styles.pop} data-tone="orange" data-text="omnimodel.">omnimodel.</span>
              </p>
            </div>
          </div>

          {/* STAGE B — the network (looping draw + pulse) */}
          <div className={styles.stage}>
            <svg className={styles.stageNet} viewBox="0 0 600 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true" ref={netRef}>
              {ARCS.map((e, k) => (
                <path
                  key={k}
                  d={arcPath(NODES[e.a], NODES[e.b])}
                  className={clsxSel(styles.netArc, e.chain && styles.netArcChain)}
                  style={{stroke: e.chain ? orange.hex : '#8b95a7'}}
                  fill="none"
                />
              ))}
              {NODES.map((n, i) => (
                <circle key={i} cx={n[0]} cy={n[1]} r={i < 4 ? 4 : 2.4} style={{fill: i < 4 ? orange.hex : '#aeb8c4'}} />
              ))}
              <path
                ref={pulseRef}
                className={styles.pulse}
                style={{stroke: orange.hex}}
                d={`${arcPath(NODES[0], NODES[1])} ${arcPath(NODES[1], NODES[2]).replace('M' + NODES[1][0] + ',' + NODES[1][1], '')} ${arcPath(NODES[2], NODES[3]).replace('M' + NODES[2][0] + ',' + NODES[2][1], '')}`}
                fill="none"
              />
            </svg>
            <span className={styles.stageTag}>the network — orange lines + pulse</span>
          </div>

          <p className={styles.foot}>
            Happy with a set? Tell me (e.g. &ldquo;g1 / r1 / o1&rdquo;) and I&apos;ll lock it
            as the standard, then rebuild the seam reusing your original zipper + network
            with the real morph.
          </p>
        </div>
      </main>
    </Layout>
  );
}

// tiny local clsx (avoid an import)
function clsxSel(...xs) {
  return xs.filter(Boolean).join(' ');
}
