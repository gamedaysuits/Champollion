import React, { useEffect, useRef } from 'react';
import styles from './ProvenanceTip.module.css';

/**
 * ProvenanceTip — the scientific-honesty affordance.
 *
 * A small ⓘ that, on hover or keyboard focus, reveals where a number
 * or claim comes from and when it was last verified. Reuses the
 * leaderboard InfoTip pattern as a shared component so every surface
 * (homepage stats, arena contrast module, featured card) shows
 * provenance the same way.
 *
 * First-view pulse: the first time a tip scrolls into view it emits one
 * soft ring so visitors notice the receipts exist. Once, subtle, and
 * fully disabled under prefers-reduced-motion (CSS-gated).
 *
 * Every string passed here should correspond to an entry in
 * cli/website/CLAIMS.md.
 *
 * Props:
 *   source — required. Plain-language source, e.g. "tc-index.json — 7,927 entries".
 *   date   — optional. Verification date, e.g. "2026-06-11".
 */
export default function ProvenanceTip({source, date}) {
  const ref = useRef(null);
  const label = date ? `Source: ${source} · verified ${date}` : `Source: ${source}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return undefined;
    if (!('IntersectionObserver' in window)) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          el.classList.add(styles.tipSeen);
          io.disconnect();
        }
      },
      {threshold: 0.9},
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      className={styles.tip}
      tabIndex={0}
      role="note"
      data-tooltip={label}
      aria-label={label}
    >
      ⓘ
    </span>
  );
}
