import React, {useEffect, useMemo, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import {loadLanguageNameMap} from '../utils/languageLoader';
import {
  MARQUEE_MIN_ROWS,
  formatRunChip,
  recentRunsUrl,
} from '../utils/recentRuns.mjs';
import styles from './RecentRunsStrip.module.css';

/**
 * RecentRunsStrip — "Latest network runs": a full-width trust-band strip at
 * the bottom of the hero, before the zipper scroll. Each chip is one
 * freshly published run (pair · model · chrF++ · date), newest first, live
 * from the public run_cards read (same anon REST the leaderboard uses).
 *
 * Honesty + fail-soft: a fetch error or an empty board renders NOTHING —
 * a trust-band slot never shows an empty shell, and an unreachable board is
 * never mistaken for "no runs". Scores are the leaderboard's automated
 * proxy scores; the strip links there, where the full disclaimer lives.
 *
 * Motion contract (index.js §"the motion contract"): pure-CSS transform
 * marquee (the LanguageTicker pattern — two duplicated tracks), paused on
 * hover and while off-viewport; prefers-reduced-motion (or a thin board,
 * < MARQUEE_MIN_ROWS) renders a static row. No rAF — the hero canvas pair
 * stays the page's only rAF layer.
 */

// Supabase public config — safe to embed (RLS restricts to read-only);
// identical constants to leaderboard.js.
const SUPABASE_URL = 'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

export default function RecentRunsStrip() {
  const [rows, setRows] = useState(null);
  const [nameMap, setNameMap] = useState(null);
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(recentRunsUrl(SUPABASE_URL), {
      headers: {apikey: SUPABASE_ANON_KEY},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setRows(data);
      })
      .catch(() => {}); // fail-soft: strip simply doesn't render
    loadLanguageNameMap()
      .then((m) => {
        if (!cancelled && m) setNameMap(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The strip expanding after the fetch changes the page height ABOVE the
  // GSAP-pinned ZipperSeam; a resize event makes ScrollTrigger recompute its
  // positions (fires once, after the rows have committed to the DOM).
  useEffect(() => {
    if (rows && rows.length && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('resize'));
    }
  }, [rows]);

  // Pause the CSS animation while the strip is off-viewport.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => setPaused(!entries.some((e) => e.isIntersecting)),
      {threshold: 0},
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rows]);

  const chips = useMemo(() => {
    if (!rows) return [];
    return rows
      .map((row) => formatRunChip(row, nameMap))
      .filter(Boolean);
  }, [rows, nameMap]);

  // DOM-STABILITY CONTRACT: this section must exist from the FIRST render
  // and never unmount. It sits immediately before ZipperSeam, whose root
  // node GSAP re-parents into a pin-spacer at mount; if this component
  // mounted late (fetch-then-insert), React's insertBefore anchor would be
  // ZipperSeam's moved node and the whole page crashes ("not a child of
  // this node"). Empty/error states therefore render the same <section>,
  // hidden — visually nothing, structurally permanent.
  const empty = !chips.length;

  const renderChip = (chip, i) => (
    <Link
      key={`${chip.pair}-${i}`}
      className={styles.chip}
      to={`/leaderboard?pair=${encodeURIComponent(chip.pair)}`}
      title={`${chip.pairLabel} · ${chip.model} · ${chip.score}`}
    >
      <span className={styles.chipPair}>{chip.pairLabel}</span>
      <span className={styles.chipModel}>{chip.model}</span>
      <span className={styles.chipScore}>{chip.score}</span>
      {chip.date && <span className={styles.chipDate}>{chip.date}</span>}
    </Link>
  );

  const marquee = !reduced && chips.length >= MARQUEE_MIN_ROWS;

  if (empty) {
    return (
      <section
        ref={rootRef}
        className={styles.strip}
        hidden
        aria-hidden="true"
      />
    );
  }

  return (
    <section ref={rootRef} className={styles.strip} aria-label="Latest network runs">
      <div className={styles.header}>
        <span className={styles.label}>
          <Translate
            id="homepage.recentRuns.label"
            description="Label of the latest-runs strip under the hero">
            Latest network runs
          </Translate>
        </span>
        <Link className={styles.allLink} to="/leaderboard">
          <Translate
            id="homepage.recentRuns.allRuns"
            description="Link from the latest-runs strip to the leaderboard (which carries the proxy-score disclaimer)">
            automated proxy scores · all runs →
          </Translate>
        </Link>
      </div>
      {marquee ? (
        <div className={styles.trackViewport}>
          <div className={styles.trackWrap} data-paused={paused ? '' : undefined}>
            {/* Two identical tracks side-by-side for a seamless loop. */}
            <div className={styles.track}>{chips.map(renderChip)}</div>
            <div className={styles.track} aria-hidden="true">
              {chips.map((chip, i) => renderChip(chip, i + chips.length))}
            </div>
          </div>
          <div className={styles.fadeLeft} aria-hidden="true" />
          <div className={styles.fadeRight} aria-hidden="true" />
        </div>
      ) : (
        <div className={styles.trackStatic}>{chips.slice(0, 12).map(renderChip)}</div>
      )}
    </section>
  );
}
