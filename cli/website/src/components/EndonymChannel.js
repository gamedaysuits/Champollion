import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useHistory} from '@docusaurus/router';
import styles from './EndonymChannel.module.css';

/**
 * EndonymChannel — the v4 landing left-rail conveyor ("the list of
 * languages"). A slow vertical channel that rotates through the WHOLE
 * catalog (data/channel.json, 7.9k rows sorted most-spoken first), printing
 * each language in its own name (vetted endonym, else the English name) with
 * its speaker count beneath. Every row links to that language's card.
 *
 * Major-language bias: the display order interleaves a recognizable major
 * (from the top of the sorted list) every MAJOR_EVERY rows, so a visitor
 * always reads the rail as "languages" while the long tail — the point of
 * the project — streams between the anchors.
 *
 * Motion: one rAF transform loop over a windowed slice (≈viewport+buffer
 * DOM nodes recycled), transform/opacity only, 60fps. Pauses on hover/focus
 * and when the tab is hidden or the rail scrolls off-screen. Reduced-motion /
 * no-JS: a static column of the first STATIC_ROWS anchors, still linked.
 *
 * Vitality tints the row's left spine (the triad used architecturally).
 */

const ROW_H = 64; // px per row (must match .row min-height in the module)
const SPEED = 16; // px/sec — "rotates slowly"
const MAJOR_EVERY = 4; // inject a major-language anchor every Nth slot
const MAJOR_POOL = 48; // draw anchors from the top-N most-spoken
const STATIC_ROWS = 14;

/**
 * Build the interleaved display order (indices into the speaker-sorted items).
 * Every MAJOR_EVERY-th slot is a recognizable anchor cycling the top
 * MAJOR_POOL; the slots between walk the REST of the catalog (from MAJOR_POOL
 * onward) so a visitor sees variety — mid- and long-tail languages — between
 * the anchors, instead of a wall of near-duplicate giants. Items are unique
 * within any short window, so no language repeats adjacently.
 */
function buildOrder(n) {
  if (n === 0) return [];
  const majorCount = Math.min(MAJOR_POOL, n);
  const order = [];
  let major = 0; // cycles the top MAJOR_POOL (the anchors)
  let tail = majorCount; // walks the catalog AFTER the anchor pool
  const tailSpan = Math.max(1, n - majorCount);
  const target = n + Math.ceil(n / (MAJOR_EVERY - 1));
  for (let i = 0; i < target; i++) {
    if (i % MAJOR_EVERY === 0) {
      order.push(major % majorCount);
      major++;
    } else {
      order.push(majorCount + ((tail - majorCount) % tailSpan));
      tail++;
    }
  }
  return order;
}

export default function EndonymChannel({heading = 'Every language, in its own name'}) {
  const history = useHistory();
  const [data, setData] = useState(null);
  const trackRef = useRef(null);
  const viewRef = useRef(null);
  const rafRef = useRef(0);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const [reduced, setReduced] = useState(false);

  // Reduced-motion (SSR-safe).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const u = () => setReduced(mq.matches);
    u();
    mq.addEventListener('change', u);
    return () => mq.removeEventListener('change', u);
  }, []);

  // Lazy-fetch the channel dataset (absolute path — shared across locales).
  useEffect(() => {
    let cancelled = false;
    fetch('/data/channel.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && Array.isArray(d.items)) setData(d);
      })
      .catch(() => {
        /* rail simply stays empty — page still works */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const order = useMemo(
    () => (data ? buildOrder(data.items.length) : []),
    [data],
  );

  // The windowed conveyor: render a fixed pool of rows, recycle via modulo,
  // drive with one rAF transform. Only runs with motion + data.
  const [windowRows, setWindowRows] = useState([]);
  useEffect(() => {
    if (reduced || !data || order.length === 0) return undefined;
    const view = viewRef.current;
    if (!view) return undefined;

    const total = order.length;
    const loopPx = total * ROW_H;
    let visible = Math.ceil(view.clientHeight / ROW_H) + 3;
    visible = Math.min(visible, total);

    let last = 0;
    let running = true;

    const render = () => {
      const off = offsetRef.current;
      const first = Math.floor(off / ROW_H);
      const slice = [];
      for (let k = 0; k < visible; k++) {
        const slot = ((first + k) % total + total) % total;
        const itemIdx = order[slot];
        slice.push({key: `${slot}`, top: (first + k) * ROW_H - off, item: data.items[itemIdx]});
      }
      setWindowRows(slice);
    };

    const tick = (now) => {
      if (!running) return;
      if (!last) last = now;
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      if (!pausedRef.current) {
        offsetRef.current = (offsetRef.current + SPEED * dt) % loopPx;
      }
      render();
      rafRef.current = requestAnimationFrame(tick);
    };

    const onVis = () => {
      pausedRef.current = document.hidden || pausedRef.current;
    };
    document.addEventListener('visibilitychange', onVis);

    // Suspend when the rail scrolls off-screen.
    let io = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (e) => {
          running = e[0].isIntersecting;
          if (running) {
            last = 0;
            rafRef.current = requestAnimationFrame(tick);
          } else {
            cancelAnimationFrame(rafRef.current);
          }
        },
        {threshold: 0.01},
      );
      io.observe(view);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onVis);
      if (io) io.disconnect();
    };
  }, [reduced, data, order]);

  const go = (code) => history.push(`/languages?q=${encodeURIComponent(code)}`);

  const renderRow = (item, style, key, recycled) => {
    const label = item.e || item.n;
    const sub = item.e ? item.n : null; // show English name under the endonym
    return (
      <a
        key={key}
        className={styles.row}
        data-vitality={item.v}
        style={style}
        href={`/languages?q=${encodeURIComponent(item.c)}`}
        onClick={(ev) => {
          ev.preventDefault();
          go(item.c);
        }}
        onMouseEnter={() => recycled && (pausedRef.current = true)}
        onMouseLeave={() => recycled && (pausedRef.current = false)}
        onFocus={() => recycled && (pausedRef.current = true)}
        onBlur={() => recycled && (pausedRef.current = false)}
        title={`${item.e ? item.e + ' · ' : ''}${item.n}`}
      >
        <span className={styles.spine} aria-hidden="true" />
        <span className={styles.rowMain}>
          <span className={styles.endonym} lang={item.d === 'rtl' ? undefined : undefined} dir={item.d}>
            {label}
          </span>
          <span className={styles.sub}>
            {sub ? <span className={styles.engName}>{sub}</span> : null}
            {item.sd ? (
              <span className={styles.speakers}>
                {item.sd} {item.sd ? 'speakers' : ''}
              </span>
            ) : (
              <span className={styles.speakersUnknown}>speaker count unrecorded</span>
            )}
          </span>
        </span>
      </a>
    );
  };

  // Reduced-motion / no-data SSR: a static, linked column of anchors.
  if (reduced || !data) {
    const statics =
      data && order.length
        ? order.slice(0, STATIC_ROWS).map((idx) => data.items[idx])
        : [];
    return (
      <aside className={styles.channel} aria-label="The languages — a selection">
        <p className={styles.heading}>{heading}</p>
        <div className={styles.staticList}>
          {statics.map((item, i) => renderRow(item, undefined, `s${i}`, false))}
        </div>
        {data ? (
          <a className={styles.allLink} href="/languages">
            Browse all {data.count.toLocaleString('en-US')} →
          </a>
        ) : null}
      </aside>
    );
  }

  return (
    <aside
      className={styles.channel}
      aria-label="The languages — a rotating index; hover to pause, click a language for its card"
    >
      <p className={styles.heading}>{heading}</p>
      <div className={styles.viewport} ref={viewRef}>
        <div className={styles.track} ref={trackRef} aria-hidden={windowRows.length === 0 ? undefined : 'false'}>
          {windowRows.map((r) =>
            renderRow(
              r.item,
              {position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${r.top}px)`},
              r.key,
              true,
            ),
          )}
        </div>
        <div className={styles.fadeTop} aria-hidden="true" />
        <div className={styles.fadeBottom} aria-hidden="true" />
      </div>
      <a className={styles.allLink} href="/languages">
        Browse all {data.count.toLocaleString('en-US')} →
      </a>
    </aside>
  );
}
