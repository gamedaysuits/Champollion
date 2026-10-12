/**
 * MetricPop — ONE pooled, reusable measurement chip for the homepage seam.
 *
 * The techy "a score being computed" readout: a slate instrument chip
 * (metric NAME in mono chrome + a ROLLING number) that pops in at a screen
 * anchor, rolls its number up, then does the house lock-and-pop in the
 * score's quality-spectrum colour. Names must be real registry metrics
 * (metricPops.mjs); numbers are illustrative under the seam's on-surface
 * caveat — this component never invents either, callers pass both.
 *
 * A fixed POOL of chips is rendered once (no per-event React churn); the
 * imperative handle drives them. All animation is TRIGGERED (real-time
 * gsap), so callers must fire on beat entry and `resetAll` on beat exit —
 * the same fire-once/reset contract as the seam's caption pops.
 *
 * @typedef {Object} MetricPopHandle
 * @property {(gsap: object, opts: {xPct: number, yPct: number, name: string,
 *   from: number, to: number, spectrumT: number, decimals?: number,
 *   holdMs?: number}) => void} fire  show the next free chip at
 *   (xPct, yPct) [% of the overlay], roll from→to, lock-pop in
 *   qualitySpectrum(spectrumT), fade after holdMs (default 1500).
 * @property {() => void} resetAll  hide every chip instantly (beat exit).
 */
import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {qualitySpectrum} from '../../utils/qualityColors.mjs';
import {playLockPop} from '../../utils/lockPop.mjs';
import styles from './MetricPop.module.css';

const POOL = 6;

const MetricPop = forwardRef(function MetricPop(_props, ref) {
  const chipRefs = useRef([]);
  const nameRefs = useRef([]);
  const numRefs = useRef([]);
  const nextRef = useRef(0);
  const liveTweens = useRef([]);

  useImperativeHandle(ref, () => ({
    fire(gsap, opts) {
      const i = nextRef.current;
      nextRef.current = (i + 1) % POOL;
      const chip = chipRefs.current[i];
      const nameEl = nameRefs.current[i];
      const numEl = numRefs.current[i];
      if (!chip || !nameEl || !numEl || !gsap) return;
      const {xPct, yPct, name, from, to, spectrumT, decimals = 0, holdMs = 1500} = opts;
      const {rgb} = qualitySpectrum(spectrumT);
      // reclaim the chip if it's mid-flight
      (liveTweens.current[i] || []).forEach((t) => t && t.kill && t.kill());
      const tweens = [];
      nameEl.textContent = name;
      numEl.textContent = from.toFixed(decimals);
      chip.style.left = `${xPct}%`;
      chip.style.top = `${yPct}%`;
      gsap.set(chip, {autoAlpha: 0, y: 8, scale: 0.92, filter: 'none'});
      tweens.push(gsap.to(chip, {autoAlpha: 1, y: 0, scale: 1, duration: 0.18, ease: 'power2.out'}));
      // the ROLL — the number computes itself upward, then locks
      const roll = {v: from};
      tweens.push(
        gsap.to(roll, {
          v: to,
          duration: 0.72,
          ease: 'power2.out',
          delay: 0.12,
          onUpdate: () => {
            numEl.textContent = roll.v.toFixed(decimals);
          },
          onComplete: () => {
            numEl.style.color = `rgb(${rgb.join(',')})`;
            tweens.push(playLockPop(gsap, chip, {rgb: rgb.join(', '), breathe: false}));
            tweens.push(
              gsap.to(chip, {
                autoAlpha: 0,
                y: -10,
                delay: holdMs / 1000,
                duration: 0.4,
                ease: 'power1.in',
                onComplete: () => {
                  numEl.style.color = '';
                },
              }),
            );
          },
        }),
      );
      liveTweens.current[i] = tweens;
    },
    resetAll() {
      for (let i = 0; i < POOL; i += 1) {
        (liveTweens.current[i] || []).forEach((t) => t && t.kill && t.kill());
        liveTweens.current[i] = [];
        const chip = chipRefs.current[i];
        const numEl = numRefs.current[i];
        if (chip) {
          chip.style.opacity = '0';
          chip.style.visibility = 'hidden';
          chip.style.transform = '';
          chip.style.filter = '';
        }
        if (numEl) numEl.style.color = '';
      }
    },
  }));

  return (
    <>
      {Array.from({length: POOL}, (_, i) => (
        <div
          key={i}
          className={styles.chip}
          style={{opacity: 0, visibility: 'hidden'}}
          ref={(el) => {
            chipRefs.current[i] = el;
          }}
        >
          <i
            ref={(el) => {
              nameRefs.current[i] = el;
            }}
          />
          <b
            ref={(el) => {
              numRefs.current[i] = el;
            }}
          />
        </div>
      ))}
    </>
  );
});

export default MetricPop;
