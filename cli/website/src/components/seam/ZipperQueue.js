/**
 * ZipperQueue — the pairwise measurement TAPE (seam beats 8 → close).
 *
 * R1 (founder 2026-07-22b): the zipper is a TURING-TAPE head, not a
 * conveyor blur. Every part means something —
 *   · a TOOTH-ROW = one language PAIR, every row labelled with its real
 *     ISO codes (legible — the queue is information, not texture);
 *   · the belt ADVANCES one row, then PAUSES under the fixed Champollion
 *     mark while the run-card measures it (rolling metrics → lock);
 *   · on lock the row's connector takes its quality-spectrum colour and the
 *     scored pair THREADS onto the map (zipper in → network out, visibly
 *     paired in time);
 *   · the tape keeps stepping through the WHOLE story tail — during the
 *     improve beat it literally revisits spa↔quz (the community re-run row);
 *   · "+ submit a method" sits at the intake end.
 *
 * All motion = one belt transform + per-row styles, driven by the page's
 * drive(p) via seamStory.tapeState — pure in scroll progress, scrub-safe.
 *
 * @typedef {Object} ZipperQueueHandle
 * @property {(alpha: number) => void} setWindow   column fade/slide (0..1)
 * @property {(offsetRows: number) => void} setRun belt translation, in rows
 * @property {(row: number, dwellT: number, arrived: boolean) => void} setHead
 *   highlight the row under the head while it's being measured
 * @property {(i: number, hex: string) => void} markScored
 * @property {(i: number) => void} resetScored
 * @property {(containerEl: Element) => {fx: number, fy: number}|null} getHeadFraction
 */
import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import BrandMark from '../BrandMark';
import {dotStyle} from '../primitives/dot.mjs';
import {edgeStyle} from '../primitives/edge.mjs';
import styles from './ZipperQueue.module.css';

const VB_W = 150;
const VB_H = 900;
const HEAD_Y = 200; // the fixed scorer (BrandMark) in viewBox units
const PITCH = 46; // one pair per PITCH units of belt travel

const pending = dotStyle('unknown', 'md');
// a queued pair: unmeasured + provisional — dashed slate until it's scored
const pendingEdge = edgeStyle('unmeasured', {provisional: true});

const ZipperQueue = forwardRef(function ZipperQueue({pairs = []}, ref) {
  const rows = pairs.length;
  const colRef = useRef(null);
  const beltRef = useRef(null);
  const headRef = useRef(null);
  const rowRefs = useRef([]);
  const zipRefs = useRef([]);
  const toothRefs = useRef([]); // [i] = [left, right]
  const labelRefs = useRef([]);

  const rowY = (i) => HEAD_Y + (i + 1) * PITCH; // queued BELOW the scorer

  useImperativeHandle(ref, () => ({
    setWindow(alpha) {
      const el = colRef.current;
      if (!el) return;
      el.style.opacity = String(alpha);
      el.style.transform = `translateX(${((1 - alpha) * 26).toFixed(1)}px)`;
    },
    setRun(offsetRows) {
      const belt = beltRef.current;
      if (!belt) return;
      const off = offsetRows * PITCH;
      belt.setAttribute('transform', `translate(0 ${(-off).toFixed(1)})`);
      // rows above the scorer fade out — they've left the queue for the map
      rowRefs.current.forEach((g, i) => {
        if (!g) return;
        const y = rowY(i) - off;
        let a = 1;
        if (y < HEAD_Y) a = Math.max(0, 1 - (HEAD_Y - y) / (PITCH * 2.4));
        else if (y > VB_H - 20) a = Math.max(0, 1 - (y - (VB_H - 20)) / 60);
        g.style.opacity = a.toFixed(3);
      });
    },
    setHead(row, dwellT, arrived) {
      // the head "computes" while dwelling: the mark brightens, the row
      // under it lifts. Pure style writes, driven from p.
      const head = headRef.current;
      if (head) {
        const work = arrived ? 0.75 + 0.25 * Math.sin(dwellT * 12.56) : 0.35;
        head.style.filter = `drop-shadow(0 0 ${(8 + work * 10).toFixed(1)}px rgba(77, 216, 255, ${(0.5 + work * 0.45).toFixed(2)}))`;
      }
      rowRefs.current.forEach((g, i) => {
        if (!g) return;
        const on = arrived && i === row;
        g.style.fontWeight = on ? '700' : '';
        const lb = labelRefs.current[i];
        if (lb) lb.style.fill = on ? '#eaf6fb' : '';
      });
    },
    markScored(i, hex) {
      const zip = zipRefs.current[i];
      const teeth = toothRefs.current[i];
      const lb = labelRefs.current[i];
      if (zip) {
        zip.setAttribute('stroke', hex);
        zip.setAttribute('stroke-dasharray', '');
        zip.setAttribute('stroke-width', '2.6');
        zip.setAttribute('opacity', '0.95');
      }
      if (teeth) {
        teeth.forEach((t) => {
          if (t) {
            t.setAttribute('fill', hex);
            t.setAttribute('opacity', '1');
          }
        });
      }
      if (lb) lb.style.fill = hex;
    },
    resetScored(i) {
      const zip = zipRefs.current[i];
      const teeth = toothRefs.current[i];
      const lb = labelRefs.current[i];
      if (zip) {
        zip.setAttribute('stroke', pendingEdge.stroke);
        zip.setAttribute('stroke-dasharray', pendingEdge.dash || '');
        zip.setAttribute('stroke-width', String(pendingEdge.strokeWidth));
        zip.setAttribute('opacity', String(pendingEdge.opacity));
      }
      if (teeth) {
        teeth.forEach((t) => {
          if (t) {
            t.setAttribute('fill', pending.fill);
            t.setAttribute('opacity', String(pending.opacity));
          }
        });
      }
      if (lb) lb.style.fill = '';
    },
    getHeadFraction(containerEl) {
      const head = headRef.current;
      if (!head || !containerEl) return null;
      const c = containerEl.getBoundingClientRect();
      if (!c.width || !c.height) return null;
      const r = head.getBoundingClientRect();
      return {
        fx: (r.left + r.width / 2 - c.left) / c.width,
        fy: (r.top + r.height / 2 - c.top) / c.height,
      };
    },
  }));

  return (
    <div className={styles.col} ref={colRef} style={{opacity: 0}} aria-hidden="true">
      <div className={styles.queueLabel}>the queue</div>
      <svg className={styles.svg} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet">
        <line data-rail x1={VB_W / 2} x2={VB_W / 2} y1={24} y2={VB_H - 12} className={styles.rail} />
        <g data-belt ref={beltRef}>
          {pairs.map((pr, i) => {
            const y = rowY(i);
            return (
              <g
                key={i}
                data-row={i}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
              >
                <line
                  data-zip
                  x1={VB_W / 2 - 13}
                  x2={VB_W / 2 + 13}
                  y1={y}
                  y2={y}
                  ref={(el) => {
                    zipRefs.current[i] = el;
                  }}
                  stroke={pendingEdge.stroke}
                  strokeWidth={pendingEdge.strokeWidth}
                  strokeDasharray={pendingEdge.dash || undefined}
                  opacity={pendingEdge.opacity}
                />
                {[-18, 18].map((dx, k) => (
                  <circle
                    key={k}
                    data-tooth
                    cx={VB_W / 2 + dx}
                    cy={y}
                    r={pending.r + 0.6}
                    fill={pending.fill}
                    opacity={pending.opacity}
                    ref={(el) => {
                      if (!toothRefs.current[i]) toothRefs.current[i] = [];
                      toothRefs.current[i][k] = el;
                    }}
                  />
                ))}
                <text
                  data-pairlabel
                  x={VB_W / 2}
                  y={y + 19}
                  className={styles.pairLabel}
                  textAnchor="middle"
                  ref={(el) => {
                    labelRefs.current[i] = el;
                  }}
                >
                  {pr.a} ↔ {pr.b}
                  {pr.rerun ? ' ⟳' : ''}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {/* the fixed scorer — the tape head the belt pauses under */}
      <span
        className={styles.head}
        ref={headRef}
        style={{top: `${((HEAD_Y - 24) / VB_H) * 100}%`}}
      >
        <BrandMark size={44} />
      </span>
      <div className={styles.submitHint}>+ submit a method → the queue</div>
    </div>
  );
});

export default ZipperQueue;
