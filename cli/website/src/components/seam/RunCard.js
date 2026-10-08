/**
 * RunCard — the tape head's instrument panel (founder R1, 2026-07-22b).
 *
 * A real run is (pair · method · benchmark) → a table of metric scores, all
 * computed together. This panel shows exactly that while the Turing-tape
 * head dwells on a row:
 *
 *   MEASURING            fao ↔ dan
 *   method NLLB-200 · benchmark Tatoeba
 *   chrF++   ▸ 83.1   (rolling → locks in its spectrum colour)
 *   COMET    ▸ 0.79
 *   spBLEU   ▸ 71.4
 *   illustrative demo · live scores on the leaderboard
 *
 * The panel is REUSED for the beat variants (community re-measure, the
 * spa→quz route test) via the kicker/fields — one instrument, not three.
 * Metric NAMES come from metricPops (registry-validated); the footer is the
 * seam's single standing illustrative disclosure (standard mono — the R1
 * font-hierarchy cleanup killed the italic footnote style).
 *
 * All values are DRIVEN by the page per-frame (pure functions of scroll
 * progress) through the imperative handle; the only triggered effect is the
 * house lock-and-pop when a run completes (fire-once, reset-below — the
 * page's standard contract).
 *
 * R3 (2026-07-22d): the metric table is VARIABLE (2–4 rows) — a pair only shows
 * the lenses that are valid for it (COMET/AfriCOMET are gated per language in
 * seamRuns), so COMET can never appear on a pair where it is invalid. Rows past
 * the pair's metric count are hidden. The benchmark line is whatever the page
 * hands it — the derived corpus + licence, or "no held-out benchmark yet".
 *
 * @typedef {Object} RunCardHandle
 * @property {(alpha: number) => void} setVisible
 * @property {(f: {kicker: string, pair: string, method: string, benchmark: string, tone?: string}) => void} setHeader
 * @property {(k: number, name: string, text: string, lockedHex: string|null) => void} setMetric
 * @property {(n: number) => void} setMetricCount  show n rows, hide the rest
 * @property {(gsap: object, rgb: string) => void} popLock  the run-complete clunk
 * @property {() => void} resetPop
 * @property {(containerEl: Element) => {fx: number, fy: number}|null} getAnchor
 */
import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {playLockPop} from '../../utils/lockPop.mjs';
import {RUNCARD} from '../../utils/seamStory.mjs';
import styles from './RunCard.module.css';

// The table renders up to 4 slots; setMetricCount hides the unused tail so the
// card fits a 2-lens pair (e.g. spa↔quz: chrF++ · spBLEU · TER) as cleanly as a
// 4-lens one (dan↔spa: chrF++ · COMET · spBLEU · TER).
const METRIC_ROWS = 4;

const RunCard = forwardRef(function RunCard(_props, ref) {
  const cardRef = useRef(null);
  const kickerRef = useRef(null);
  const pairRef = useRef(null);
  const runlineRef = useRef(null);
  const rowRefs = useRef([]);
  const nameRefs = useRef([]);
  const valRefs = useRef([]);
  const popTl = useRef(null);

  useImperativeHandle(ref, () => ({
    setVisible(alpha) {
      const el = cardRef.current;
      if (!el) return;
      el.style.opacity = String(alpha);
      el.style.transform = `translateY(${((1 - alpha) * 10).toFixed(1)}px)`;
    },
    setHeader({kicker, pair, method, benchmark, tone}) {
      if (kickerRef.current) {
        kickerRef.current.textContent = kicker;
        kickerRef.current.style.color = tone || '';
      }
      if (pairRef.current) pairRef.current.textContent = pair;
      if (runlineRef.current) runlineRef.current.textContent = `method ${method} · benchmark ${benchmark}`;
    },
    setMetric(k, name, text, lockedHex) {
      const nm = nameRefs.current[k];
      const vl = valRefs.current[k];
      if (nm) nm.textContent = name;
      if (vl) {
        vl.textContent = text;
        vl.style.color = lockedHex || '';
      }
    },
    setMetricCount(n) {
      // Show the first n metric rows, hide the rest — a pair only shows the
      // lenses valid for it (variable 2–4). Pure per-frame; cheap to call.
      rowRefs.current.forEach((el, k) => {
        if (el) el.style.display = k < n ? '' : 'none';
      });
    },
    popLock(gsap, rgb) {
      if (!cardRef.current || !gsap) return;
      if (popTl.current) popTl.current.kill();
      popTl.current = playLockPop(gsap, cardRef.current, {rgb, breathe: false});
    },
    resetPop() {
      if (popTl.current) {
        popTl.current.kill();
        popTl.current = null;
      }
      const el = cardRef.current;
      if (el) {
        el.style.scale = '';
        el.style.filter = '';
      }
    },
    getAnchor(containerEl) {
      const el = cardRef.current;
      if (!el || !containerEl) return null;
      const c = containerEl.getBoundingClientRect();
      if (!c.width || !c.height) return null;
      const r = el.getBoundingClientRect();
      return {fx: (r.left + r.width / 2 - c.left) / c.width, fy: (r.top + r.height / 2 - c.top) / c.height};
    },
  }));

  return (
    <div className={styles.card} ref={cardRef} style={{opacity: 0}} aria-hidden="true">
      <div className={styles.kicker} ref={kickerRef}>
        MEASURING
      </div>
      <div className={styles.pair} ref={pairRef} />
      <div className={styles.runline} ref={runlineRef} />
      <div className={styles.table}>
        {Array.from({length: METRIC_ROWS}, (_, k) => (
          <div
            key={k}
            className={styles.metricRow}
            ref={(el) => {
              rowRefs.current[k] = el;
            }}
          >
            <i
              ref={(el) => {
                nameRefs.current[k] = el;
              }}
            />
            <b
              ref={(el) => {
                valRefs.current[k] = el;
              }}
            />
          </div>
        ))}
      </div>
      <div className={styles.foot}>{RUNCARD.footer}</div>
    </div>
  );
});

export default RunCard;
