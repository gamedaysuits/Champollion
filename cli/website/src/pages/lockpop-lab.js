import React, {useEffect, useRef} from 'react';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import {playLockPop, setLocked} from '../utils/lockPop.mjs';
import styles from './lockpop-lab.module.css';

/**
 * /lockpop-lab — motion study for the "lock-and-pop" house-style effect.
 *
 * Unlinked, noindex. The founder chose two existing seam moments as the
 * brand's visual guide — the chrF++ score climbing-and-locking through tests
 * (Beat 4) and the sovereign seal's pulsing strength (Beat 5). This page
 * isolates the distilled primitive (src/utils/lockPop.mjs) in those three
 * contexts so the FEEL can be approved before it goes into ZipperSeamV2.
 */

// Split an element's text (from data-text) into inline-block word spans and
// return them. Idempotent across replays because it always rebuilds from
// the original data-text.
function splitWords(el, wordClass) {
  const text = el.getAttribute('data-text') || el.textContent;
  el.setAttribute('data-text', text);
  el.textContent = '';
  const words = text.split(/\s+/).filter(Boolean);
  return words.map((w, i) => {
    const span = document.createElement('span');
    span.className = wordClass;
    span.textContent = w;
    el.appendChild(span);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    return span;
  });
}

// The zipper-stitch reveal: evens drop from above, odds rise from below —
// the same word-by-word motion the seam uses (ZipperSeam stitchIn).
function reveal(gsap, tl, words, at) {
  const evens = words.filter((_, i) => i % 2 === 0);
  const odds = words.filter((_, i) => i % 2 === 1);
  const opts = {yPercent: 0, opacity: 1, duration: 0.34, stagger: 0.05, ease: 'back.out(1.7)'};
  if (evens.length) tl.fromTo(evens, {yPercent: -55, opacity: 0}, opts, at);
  if (odds.length) tl.fromTo(odds, {yPercent: 55, opacity: 0}, opts, at);
  return at + Math.max(evens.length, odds.length) * 0.05 + 0.34;
}

export default function LockPopLab() {
  const gsapRef = useRef(null);
  const reducedRef = useRef(false);

  // demo 1 — word emphasis
  const leadRef = useRef(null);
  const popRef = useRef(null);
  // demo 2 — score climb
  const scoreRef = useRef(null);
  const scoreNumRef = useRef(null);
  const capRef = useRef(null);
  const tickRefs = useRef([]);
  // demo 3 — sovereign
  const sealRef = useRef(null);

  // ---- demo players (defined via refs so buttons can call them) ----
  const players = useRef({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      const mod = await import('gsap');
      if (!mounted) return;
      const gsap = mod.gsap || mod.default;
      gsapRef.current = gsap;
      try {
        reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (e) {
        reducedRef.current = false;
      }

      // ---------------- 1. word emphasis ----------------
      players.current.words = () => {
        const lead = leadRef.current;
        const pop = popRef.current;
        if (!lead || !pop) return;
        gsap.killTweensOf('*');
        const leadWords = splitWords(lead, styles.word);
        const popWords = splitWords(pop, styles.word);
        gsap.set(pop, {scale: 1, clearProps: 'filter'});
        if (reducedRef.current) {
          gsap.set([...leadWords, ...popWords], {yPercent: 0, opacity: 1});
          setLocked(gsap, pop, {tone: 'frontier'});
          return;
        }
        const tl = gsap.timeline();
        const afterLead = reveal(gsap, tl, leadWords, 0.1);
        const afterPop = reveal(gsap, tl, popWords, afterLead - 0.1);
        tl.add(() => playLockPop(gsap, pop, {tone: 'frontier'}), afterPop);
      };

      // ---------------- 2. score climb through tests ----------------
      players.current.score = () => {
        const chip = scoreRef.current;
        const num = scoreNumRef.current;
        const cap = capRef.current;
        const ticks = tickRefs.current.filter(Boolean);
        if (!chip || !num) return;
        gsap.killTweensOf(chip);
        const steps = [24, 41, 55, 63, 71];
        chip.setAttribute('data-verified', 'false');
        gsap.set(chip, {scale: 1, clearProps: 'filter'});
        ticks.forEach((t) => t && t.setAttribute('data-on', 'false'));
        if (reducedRef.current) {
          num.textContent = String(steps[steps.length - 1]);
          chip.setAttribute('data-verified', 'true');
          ticks.forEach((t) => t && t.setAttribute('data-on', 'true'));
          if (cap) cap.textContent = 'locked · verified';
          setLocked(gsap, chip, {tone: 'verified'});
          return;
        }
        num.textContent = String(steps[0]);
        if (cap) cap.textContent = 'running tests…';
        const tl = gsap.timeline();
        steps.forEach((val, i) => {
          const at = 0.1 + i * 0.5;
          const last = i === steps.length - 1;
          tl.add(() => {
            num.textContent = String(val);
            if (ticks[i]) ticks[i].setAttribute('data-on', 'true');
            if (cap) cap.textContent = last ? 'locked · verified' : `test ${i + 1} of ${steps.length}`;
            if (last) chip.setAttribute('data-verified', 'true');
          }, at);
          if (!last) {
            // per-test "buzz" — a quick charge blip as each result lands
            tl.to(chip, {scale: 1.06, duration: 0.09, yoyo: true, repeat: 1, ease: 'power2.out'}, at);
          } else {
            tl.add(() => playLockPop(gsap, chip, {tone: 'verified'}), at + 0.02);
          }
        });
      };

      // ---------------- 3. sovereign strength ----------------
      players.current.seal = () => {
        const seal = sealRef.current;
        if (!seal) return;
        gsap.killTweensOf(seal);
        gsap.set(seal, {scale: 1, opacity: 1, clearProps: 'filter'});
        if (reducedRef.current) {
          setLocked(gsap, seal, {tone: 'verified'});
          return;
        }
        const tl = gsap.timeline();
        tl.fromTo(seal, {opacity: 0, y: 16, scale: 0.94}, {opacity: 1, y: 0, scale: 1, duration: 0.42, ease: 'power2.out'}, 0);
        tl.add(() => playLockPop(gsap, seal, {tone: 'verified', peak: 1.05}), 0.42);
      };

      players.current.all = () => {
        players.current.words();
        players.current.score();
        players.current.seal();
      };

      // Dev-only handle: lets the effect be frame-stepped for verification in
      // preview panes that report document.hidden (rAF is paused there).
      if (typeof window !== 'undefined') {
        window.__LP = {gsap, players: players.current};
      }

      // autoplay once on mount
      players.current.all();
    })();

    return () => {
      mounted = false;
      const gsap = gsapRef.current;
      if (gsap) gsap.killTweensOf('*');
    };
  }, []);

  const run = (name) => () => players.current[name] && players.current[name]();

  return (
    <Layout
      title="Lock-and-Pop — motion study"
      description="Isolated study of the Champollion lock-and-pop house-style effect."
      noFooter>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className={styles.main}>
        <div className={styles.inner}>
          <header className={styles.pageHead}>
            <p className={styles.pageKicker}>Motion study</p>
            <h1 className={styles.pageTitle}>Lock-and-Pop</h1>
            <p className={styles.pageSub}>
              The house-style emphasis effect, distilled from the two seam moments
              chosen as the visual guide: the chrF++ score climbing then snapping in,
              and the sovereign seal's pulsing strength. Charge → pop → lock → a held
              glow that breathes.
            </p>
          </header>

          {/* 1 — word emphasis */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>1 · Word emphasis</span>
              <span className={styles.cardNote}>
                Words reveal one by one; the emphasis phrase charges, pops, and locks
                amber — then breathes.
              </span>
            </div>
            <div className={styles.stage}>
              <h2 className={styles.line}>
                <span ref={leadRef} className={styles.lead} data-text="We don't pick a winner.">
                  We don&apos;t pick a winner.
                </span>{' '}
                <span ref={popRef} className={styles.popPhrase} data-text="We measure.">
                  We measure.
                </span>
              </h2>
            </div>
            <button type="button" className={`${styles.btn} ${styles.cardBtn}`} onClick={run('words')}>
              ▸ Replay
            </button>
          </section>

          {/* 2 — score climb through tests */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>2 · Score climbing through tests</span>
              <span className={styles.cardNote}>
                The chrF++ score buzzes up through each test, then locks green with a
                held glow — the Beat-4 signature.
              </span>
            </div>
            <div className={styles.stage}>
              <div className={styles.scoreRow}>
                <span ref={scoreRef} className={styles.scoreChip} data-verified="false">
                  <span ref={scoreNumRef}>24</span>
                  <span className={styles.scoreUnit}>chrF++</span>
                </span>
                <div className={styles.testTicks}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      ref={(el) => {
                        tickRefs.current[i] = el;
                      }}
                      className={styles.testTick}
                      data-on="false"
                      data-final={i === 4 ? 'true' : 'false'}
                    />
                  ))}
                </div>
                <span ref={capRef} className={styles.testCaption}>
                  running tests…
                </span>
              </div>
            </div>
            <button type="button" className={`${styles.btn} ${styles.cardBtn}`} onClick={run('score')}>
              ▸ Replay
            </button>
          </section>

          {/* 3 — sovereign strength */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>3 · Sovereign strength</span>
              <span className={styles.cardNote}>
                The seal locks into place and holds a breathing pulse of strength; the
                sealed data shimmers, live but unreadable.
              </span>
            </div>
            <div className={styles.stage}>
              <div ref={sealRef} className={styles.seal}>
                <div className={styles.sealHead}>
                  <span className={styles.sealBadge}>Tier 2 · Sovereign</span>
                </div>
                <span className={styles.sealTitle}>Sealed test set · verified</span>
                <div className={styles.sealBars}>
                  <span className={styles.sealBar} />
                  <span className={styles.sealBar} />
                  <span className={styles.sealBar} />
                </div>
              </div>
            </div>
            <button type="button" className={`${styles.btn} ${styles.cardBtn}`} onClick={run('seal')}>
              ▸ Replay
            </button>
          </section>

          <div className={styles.controls}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={run('all')}>
              ▸ Replay all
            </button>
          </div>
          <p className={styles.reducedNote}>
            Under prefers-reduced-motion this page renders each effect's locked
            end-state with no animation.
          </p>
        </div>
      </main>
    </Layout>
  );
}
