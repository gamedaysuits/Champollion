import React, {useEffect, useState, useMemo} from 'react';
import clsx from 'clsx';
import {useHistory} from '@docusaurus/router';
import styles from './LanguageTicker.module.css';

/**
 * LanguageTicker — a modern horizontal marquee of endonyms.
 *
 * Replaces the vertical EndonymChannel. Shows a selection of languages
 * scrolling horizontally in a continuous loop — like a trust-badge runner
 * on a modern SaaS landing page. Each chip shows the endonym + English
 * name, tinted by vitality status. Click navigates to the card.
 *
 * Pure CSS animation (transform only), no rAF. Two copies of the track
 * placed side-by-side scroll seamlessly. Respects reduced-motion (static
 * row, no scroll).
 *
 * @param {object} props
 * @param {number} [props.count=32] — how many languages to show per track
 */

const TICKER_COUNT = 32;

export default function LanguageTicker({count = TICKER_COUNT}) {
  const history = useHistory();
  const [data, setData] = useState(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const u = () => setReduced(mq.matches);
    u();
    mq.addEventListener('change', u);
    return () => mq.removeEventListener('change', u);
  }, []);

  // Use the same channel.json as EndonymChannel (shared build data).
  useEffect(() => {
    let cancelled = false;
    fetch('/data/channel.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && Array.isArray(d.items)) setData(d);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Sample a balanced mix: interleave major + long-tail languages.
  const chips = useMemo(() => {
    if (!data) return [];
    const items = data.items;
    const majorPool = Math.min(24, items.length);
    const result = [];
    let major = 0;
    let tail = majorPool;
    const tailLen = Math.max(1, items.length - majorPool);
    for (let i = 0; i < count; i++) {
      if (i % 3 === 0 && major < majorPool) {
        result.push(items[major++]);
      } else {
        result.push(items[majorPool + ((tail++ - majorPool) % tailLen)]);
      }
    }
    return result;
  }, [data, count]);

  if (!chips.length) return null;

  const go = (code) => history.push(`/languages?q=${encodeURIComponent(code)}`);

  const renderChip = (item, i) => {
    const label = item.e || item.n;
    return (
      <a
        key={`${item.c}-${i}`}
        className={styles.chip}
        data-vitality={item.v}
        href={`/languages?q=${encodeURIComponent(item.c)}`}
        onClick={(ev) => {
          ev.preventDefault();
          go(item.c);
        }}
        title={`${item.e ? item.e + ' · ' : ''}${item.n}`}
        dir={item.d}
      >
        <span className={styles.chipEndonym}>{label}</span>
        {item.e && <span className={styles.chipName}>{item.n}</span>}
      </a>
    );
  };

  // Reduced motion: static row, no scrolling.
  if (reduced) {
    return (
      <div className={clsx('labV4', styles.ticker)} aria-label="Languages in the catalog">
        <div className={styles.trackStatic}>
          {chips.slice(0, 12).map(renderChip)}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('labV4', styles.ticker)} aria-label="Languages in the catalog — scrolling">
      <div className={styles.trackWrap}>
        {/* Two identical tracks side-by-side for seamless loop. */}
        <div className={styles.track} aria-hidden="false">
          {chips.map(renderChip)}
        </div>
        <div className={styles.track} aria-hidden="true">
          {chips.map((item, i) => renderChip(item, i + count))}
        </div>
      </div>
      {/* Edge fades for polish. */}
      <div className={styles.fadeLeft} aria-hidden="true" />
      <div className={styles.fadeRight} aria-hidden="true" />
    </div>
  );
}
