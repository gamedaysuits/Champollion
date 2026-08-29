/**
 * CommandCard — the one command, and what it does (R8, founder 2026-08-07).
 *
 * This replaces MethodLoop's `mt-eval run` ring, which the founder called "a
 * weird MT EVAL RUN graphic, total garbage". The objection was right and it was
 * structural, not cosmetic: the ring argued "anyone can build one" by GEOMETRY —
 * three overlapping laps, each shorter than the last — and left the visitor with
 * a command fragment that installs nothing and a shape to admire. The claim is
 * unchanged; the argument is now literal. Here is the command. Here is a button
 * that copies it. Here are the runs it starts, landing on the map behind you.
 *
 * HONESTY. The command is `RUN_QUEUE` from seamStory, which is guard-tested
 * VERBATIM against `cli/website/static/run_queue` — the seam physically cannot
 * ship a command that script would reject. Both lines are shown because the
 * script needs a key and we will not pretend otherwise: it auto-detects whichever
 * of the four it finds, so the visitor exports the one they already have. The
 * `--budget` cap is visible for the same reason — never put a command on a
 * homepage that could spend an unbounded amount of someone else's money.
 *
 * The three run rows carry LOOP_LAPS unchanged (guard-tested: real methods, each
 * genuinely improving the pair it touches, overlapping, each faster than the
 * last). Their scores are illustrative under the standing run-card footer.
 *
 * @typedef {Object} CommandCardHandle
 * @property {(alpha:number)=>void} setWindow  visibility (also gates focus)
 * @property {(v:number)=>void} setRuns        the one per-frame call; PURE in v
 * @property {(k:number, gsap:object)=>void} popScore
 * @property {(k:number)=>void} resetPop
 * @property {()=>{cx:number,cy:number}|null} getExitPoint
 */
import React, {forwardRef, useCallback, useImperativeHandle, useRef, useState} from 'react';
import {measureText} from '../../utils/seamMetrics.mjs';
import {RUNCARD, RUN_QUEUE, TAPE_LOCK_AT, LOOP_LAPS, STORY_PAIRS} from '../../utils/seamStory.mjs';
import {qualitySpectrum} from '../../utils/qualityColors.mjs';
import {playLockPop} from '../../utils/lockPop.mjs';
import styles from './CommandCard.module.css';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ss = (k) => {
  const t = clamp01(k);
  return t * t * (3 - 2 * t);
};

/** each lap = one queue run, on a REAL tape pair (LOOP_LAPS is guard-tested) */
const RUNS = LOOP_LAPS.map((L) => ({...L, pair: STORY_PAIRS[L.row]}));

const CommandCard = forwardRef(function CommandCard(_props, ref) {
  const wrapRef = useRef(null);
  const termRef = useRef(null);
  const barRef = useRef(null); // the sweep under the command — it FIRING
  const rowRefs = useRef([]);
  const scoreRefs = useRef([]);
  const exitRef = useRef(null);
  const popTls = useRef([]);
  /** 'idle' | 'copied' | 'select' — never a silent no-op (see onCopy) */
  const [copyState, setCopyState] = useState('idle');

  /* The copy affordance is the ONE piece of live state in the whole seam. It is
   * React-local and never reachable from drive(), so the scroll clock and the
   * user's clock never meet.
   *
   * THREE TIERS, and no silent failure. The async Clipboard API is unavailable
   * on insecure origins and can be refused outright by permissions policy — the
   * project's other two copy buttons both swallow that and leave the user
   * clicking a button that does nothing. So: try the async API, fall back to the
   * legacy execCommand path, and if BOTH fail, select the command in the page
   * and say "press ⌘C" rather than pretending it worked. */
  const onCopy = useCallback(() => {
    const text = `${RUN_QUEUE.env}\n${RUN_QUEUE.cmd}`;
    const flash = (state) => {
      setCopyState(state);
      setTimeout(() => setCopyState('idle'), state === 'copied' ? 1800 : 3200);
    };

    const legacy = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
        return !!ok;
      } catch (err) {
        return false;
      }
    };

    // last resort: put the command under the user's own cursor
    const selectInPage = () => {
      const el = termRef.current;
      if (!el || typeof window.getSelection !== 'function') return;
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    };

    const fallback = () => {
      if (legacy()) {
        flash('copied');
      } else {
        selectInPage();
        flash('select');
      }
    };

    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => flash('copied'), fallback);
    } else {
      fallback();
    }
  }, []);

  useImperativeHandle(ref, () => ({
    setWindow(alpha) {
      const el = wrapRef.current;
      if (!el) return;
      el.style.opacity = String(alpha);
      el.style.transform = `translate(-50%, calc(-50% + ${((1 - alpha) * 12).toFixed(1)}px))`;
      // MethodLoop could be aria-hidden because it was decoration. This card
      // holds a real <button>, so it must not be — an invisible card is taken
      // out of the tab order and hit-testing with `visibility` instead.
      el.style.visibility = alpha < 0.02 ? 'hidden' : 'visible';
    },
    /** PURE in v (0..1 across CMD_WIN). No state, no time, no randomness. */
    setRuns(v) {
      let sweep = 0;
      RUNS.forEach((L, k) => {
        const th = clamp01((v - L.start) / L.span);
        // the command fires as each run departs — the bar sweeps, every time,
        // and never grows: one command, always the same one.
        if (th > 0 && th < 0.14) sweep = Math.max(sweep, 1 - th / 0.14);
        const row = rowRefs.current[k];
        if (row) {
          const on = ss(clamp01((th - 0.02) / 0.14));
          const out = 1 - ss(clamp01((th - 0.94) / 0.06));
          row.style.opacity = String(th > 0 ? on * out : 0);
          row.style.transform = `translateY(${((1 - on) * 6).toFixed(1)}px)`;
        }
        const sc = scoreRefs.current[k];
        if (sc) {
          const dwellT = clamp01((th - 0.3) / 0.2);
          sc.textContent = measureText('chrF++', L.qNew, {
            arrived: th >= 0.3,
            dwellT,
            lockAt: TAPE_LOCK_AT,
            seed: k + 2,
          });
          sc.style.color = dwellT >= TAPE_LOCK_AT ? qualitySpectrum(L.qNew).hex : '';
        }
      });
      if (barRef.current) barRef.current.style.transform = `scaleX(${sweep.toFixed(3)})`;
    },
    popScore(k, gsap) {
      const el = scoreRefs.current[k];
      if (!el || !gsap) return;
      if (popTls.current[k]) popTls.current[k].kill();
      popTls.current[k] = playLockPop(gsap, el, {
        rgb: qualitySpectrum(RUNS[k].qNew).rgb.join(', '),
        breathe: false,
      });
    },
    resetPop(k) {
      if (popTls.current[k]) {
        popTls.current[k].kill();
        popTls.current[k] = null;
      }
      const el = scoreRefs.current[k];
      if (el) {
        el.style.scale = '';
        el.style.filter = '';
      }
    },
    /** where a completed run leaves for the map (the page reads this anchor) */
    getExitPoint() {
      const el = exitRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      return {cx: r.left + r.width / 2, cy: r.top + r.height / 2};
    },
  }));

  return (
    <div className={styles.wrap} ref={wrapRef} style={{opacity: 0, visibility: 'hidden'}}>
      <div className={styles.head}>
        <span className={styles.kicker}>RUN THE QUEUE</span>
        <button
          type="button"
          className={styles.copy}
          onClick={onCopy}
          data-state={copyState}
          aria-live="polite"
          aria-label={
            copyState === 'copied'
              ? 'Copied to clipboard'
              : copyState === 'select'
                ? 'Clipboard unavailable — the command is selected, press Command or Control C'
                : 'Copy command to clipboard'
          }
        >
          <span className={styles.copyGlyph} aria-hidden="true">
            ⧉
          </span>
          <span className={styles.copyTip}>
            {copyState === 'copied' ? 'copied ✓' : copyState === 'select' ? 'selected — press ⌘C' : 'copy command'}
          </span>
        </button>
      </div>

      <pre className={styles.term} ref={termRef}>
        <code>
          <span className={styles.line}>
            <span className={styles.prompt}>$</span>
            {RUN_QUEUE.env} <span className={styles.comment}>{RUN_QUEUE.envNote}</span>
          </span>
          <span className={`${styles.line} ${styles.lineMain}`}>
            <span className={styles.prompt}>$</span>
            {RUN_QUEUE.cmd}
            <span className={styles.bar} ref={barRef} aria-hidden="true" />
          </span>
        </code>
      </pre>

      <div className={styles.does}>{RUN_QUEUE.does}</div>

      <div className={styles.runs} aria-hidden="true">
        {RUNS.map((L, k) => (
          <div
            key={L.method}
            className={styles.run}
            style={{opacity: 0}}
            ref={(el) => {
              rowRefs.current[k] = el;
            }}
          >
            <span className={styles.runPair}>
              {L.pair.a} ↔ {L.pair.b}
            </span>
            <span className={styles.runMethod}>{L.method}</span>
            <b
              className={styles.runScore}
              ref={(el) => {
                scoreRefs.current[k] = el;
              }}
            />
          </div>
        ))}
      </div>

      <span className={styles.exit} ref={exitRef} aria-hidden="true" />
      <div className={styles.foot}>{RUNCARD.footer}</div>
    </div>
  );
});

export default CommandCard;
