/**
 * HubColumn — the omnimodel-escalation timeline (seam beat 5/6).
 *
 * A right-side column of real MT systems, RELEASE-DATE ordered, each row
 * `year · name · claimed-coverage count` — the visual thesis: the models keep
 * getting BIGGER (100 → 200 → 415 → 1,600) while the map stays red. Every
 * row comes from the cited coverage SSOT via seamFacts.HUBS (build-generated,
 * uncited entries never ship); the Omnilingual MT row carries Meta's OWN
 * >400-of-1,600 quality self-report. Counts are CLAIMED coverage — the
 * column's footer says so.
 *
 * Reveal is driven by the page (scrub-safe direct style writes):
 *   ref.setReveal(t) — rows stagger in chronologically as t goes 0→1.
 *   ref.getAnchors(containerEl) — per-row {key, fx, fy} viewport-fraction
 *   anchors (kept for layout tooling; R2 removed all pulse traffic to/from
 *   the cards — packets travel between LANGUAGES, instruments only observe).
 *
 * R1 reframe (founder): the Omnilingual row does not celebrate the claim —
 * it shows the shortfall in Meta's own numbers: of the 1,600 claimed, ~1,200
 * sit BELOW their own "understood sufficiently well" bar (champollion-derived
 * arithmetic from their §1 self-report; both figures computed from the cited
 * SSOT fields, never typed). Standard mono — no italic footnote styles.
 *
 * @typedef {Object} HubColumnHandle
 * @property {(t: number) => void} setReveal
 * @property {(containerEl: Element) => Array<{key: string, fx: number, fy: number, count: number, tier: string}>} getAnchors
 */
import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {HUBS, HUBS_AS_OF, fmt} from '../../utils/seamFacts.mjs';
import styles from './HubColumn.module.css';

// Timeline = dated methods only (the escalation needs a time axis). The
// undated rest (Tilde/OPUS today) still count on the map; they're simply not
// rows in a release-date timeline.
const TIMELINE = HUBS.filter((h) => h.releaseDate);

const HubColumn = forwardRef(function HubColumn(_props, ref) {
  const rowRefs = useRef([]);

  useImperativeHandle(ref, () => ({
    setReveal(t) {
      const n = TIMELINE.length;
      rowRefs.current.forEach((el, i) => {
        if (!el) return;
        // chronological stagger: row i lives in [i/n, i/n + 1.6/n] of t
        const a = Math.min(1, Math.max(0, (t * (n + 0.6) - i) / 1.6));
        el.style.opacity = String(a);
        el.style.transform = `translateX(${((1 - a) * 18).toFixed(1)}px)`;
      });
    },
    getAnchors(containerEl) {
      if (!containerEl) return [];
      const c = containerEl.getBoundingClientRect();
      if (!c.width || !c.height) return [];
      return TIMELINE.map((h, i) => {
        const el = rowRefs.current[i];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          key: h.key,
          fx: (r.left - c.left) / c.width,
          fy: (r.top + r.height / 2 - c.top) / c.height,
          count: h.count,
          tier: h.tier,
        };
      }).filter(Boolean);
    },
  }));

  return (
    <div className={styles.col} aria-hidden="true">
      {TIMELINE.map((h, i) => (
        <div
          key={h.key}
          className={styles.row}
          data-hub={h.key}
          style={{opacity: 0}}
          ref={(el) => {
            rowRefs.current[i] = el;
          }}
        >
          <span className={styles.year}>{h.releaseDate.slice(0, 4)}</span>
          <span className={styles.name}>{h.label}</span>
          <span className={styles.count}>{fmt(h.count)}</span>
          {h.deployable ? (
            <span className={styles.report}>
              ~{fmt(h.count - h.deployable.count)} of {fmt(h.count)} below their own quality bar
            </span>
          ) : null}
        </div>
      ))}
      <div className={styles.foot}>claimed language coverage · each list cited · as of {HUBS_AS_OF}</div>
    </div>
  );
});

export default HubColumn;
