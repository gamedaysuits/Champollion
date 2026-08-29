import React, {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import Translate, {translate} from '@docusaurus/Translate';
import ProvenanceTip from './ProvenanceTip';
import FieldEngine, {fieldSupported} from './FieldEngine';
import styles from './TranslationField.module.css';

/**
 * TranslationField — the Landing v3 hero background: the machine,
 * translating, continuously (the design log §"The Landing v3").
 *
 * Real corpus sentences (CC-BY Tatoeba dev corpora) drift across the
 * full viewport, dissolve through a transformation state, and
 * crystallize as the REAL model output recorded for that exact entry
 * in an in-repo benchmark run — the RUN's corpus-level composite
 * score chip attaching on arrival (the model × pair whole-corpus
 * score, labeled "corpus composite"; design decision —
 * composite foregrounded, never raw chrF++ per the design spec).
 * Data: /data/field.json (built by
 * plugins/shared-data/generateFieldJson.js). CLAIMS.md §"The
 * Translation Field" is binding: nothing here is invented, model
 * outputs are labeled as model outputs on every flow, and the score
 * is labeled as the run's corpus-level score, never a per-sentence
 * claim.
 *
 * Progressive enhancement / a11y:
 *   - The canvas is decorative (aria-hidden, pointer-events none) and
 *     mounts only post-hydration — SSR HTML is the static composition.
 *   - prefers-reduced-motion / no-JS / no-canvas: the static
 *     composition stands — one real frozen flow (source → model output
 *     + score + reference) over the gradient field. When the canvas is
 *     live the same composition stays in the DOM for screen readers
 *     (visually hidden), so no information lives only in pixels.
 *   - The provenance legend is always-visible DOM text.
 *   - document.hidden and scrolling the hero off-screen stop the rAF
 *     loop entirely (engine.suspend via IntersectionObserver).
 */

/**
 * The frozen flow (static composition + SSR). A REAL entry from
 * data/field.json — eng-cym-dev-v1 (Tatoeba, CC-BY-2.0) entry
 * tatoeba_11472433, run run_20260611_114322_anthropic_claudesonnet46
 * (claude-sonnet-4.6). The score is that RUN's corpus-level composite,
 * 0.5703 → 0.57 (overall.confidence_intervals.composite_score.score
 * in the report; same value GraphHero's FROZEN uses): see CLAIMS.md
 * §"The Translation Field". The water dissolution the animated version
 * of this flow uses is meaning-linked ("She wants water"), per the
 * Morph v2 guardrail.
 */
const STATIC_FLOW = {
  pair: 'ENG → CYM',
  corpus: 'TATOEBA · CC-BY',
  source: 'She wants water.',
  sourceLang: 'en',
  target: 'Mae eisiau dŵr arni.',
  targetLang: 'cy',
  reference: 'Mae hi eisiau dŵr.',
  model: 'claude-sonnet-4.6',
  composite: '0.57',
};

/** Live prefers-reduced-motion hook (SSR-safe: defaults to false). */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

export default function TranslationField() {
  const reduced = useReducedMotion();
  const [fx, setFx] = useState(false);
  const canvasRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    setFx(!reduced && fieldSupported());
  }, [reduced]);

  useEffect(() => {
    if (!fx || !canvasRef.current) return undefined;
    let engine = null;
    let io = null;
    let cancelled = false;
    const fontsReady =
      typeof document !== 'undefined' && document.fonts && document.fonts.ready
        ? document.fonts.ready.catch(() => {})
        : Promise.resolve();
    Promise.all([
      // Absolute path on purpose — /data is shared across locale builds.
      fetch('/data/field.json').then((r) => (r.ok ? r.json() : null)),
      fontsReady,
    ])
      .then(([data]) => {
        if (
          cancelled ||
          !canvasRef.current ||
          !data ||
          !Array.isArray(data.flows) ||
          !data.flows.length
        ) {
          return; // static composition simply stands
        }
        engine = new FieldEngine(canvasRef.current, data);
        if (typeof window !== 'undefined') window.__FIELD_ENGINE = engine;
        if (typeof IntersectionObserver !== 'undefined') {
          io = new IntersectionObserver(
            (entries) => {
              if (!engine) return;
              if (entries[0].isIntersecting) engine.start();
              else engine.suspend();
            },
            {threshold: 0.04},
          );
          io.observe(canvasRef.current);
        } else {
          engine.start();
        }
      })
      .catch((err) => {
        /* field stays static — page still works */
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[field] init failed:', err);
        }
      });
    return () => {
      cancelled = true;
      if (io) io.disconnect();
      if (engine) engine.destroy();
    };
  }, [fx]);

  // Scroll recede fallback: where CSS scroll-driven animations are
  // unsupported, a rAF-throttled passive listener fades/translates the
  // field as the user scrolls off the hero. Skipped under reduced
  // motion and wherever the CSS path (in the module) already applies.
  useEffect(() => {
    if (reduced || typeof window === 'undefined') return undefined;
    if (
      typeof CSS !== 'undefined' &&
      CSS.supports &&
      CSS.supports('animation-timeline: scroll()')
    ) {
      return undefined;
    }
    const el = rootRef.current;
    if (!el) return undefined;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const p = Math.min(1, window.scrollY / (window.innerHeight * 0.9));
        el.style.opacity = String(1 - 0.85 * p);
        el.style.transform = `translate3d(0, ${-40 * p}px, 0)`;
      });
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <div
      ref={rootRef}
      className={clsx(styles.field, fx && styles.fieldFx)}
      data-fx={fx ? 'on' : undefined}
    >
      {fx && (
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      )}

      {/* The frozen flow — SSR'd, the reduced-motion/no-JS composition;
          screen-reader-available even when the canvas runs. */}
      <figure
        className={styles.frozen}
        aria-label={translate({
          id: 'homepage.field.frozenLabel',
          message:
            'One real translation flow: an English sentence, the model output it became, and the corpus-level composite score of the benchmark run it comes from',
          description: 'Accessible label for the static translation-field example',
        })}
      >
        <div className={clsx(styles.frozenCol, styles.frozenSource)}>
          <span className={styles.frozenMeta}>
            {STATIC_FLOW.pair} · {STATIC_FLOW.corpus}
          </span>
          <span className={styles.frozenText} lang={STATIC_FLOW.sourceLang}>
            {STATIC_FLOW.source}
          </span>
        </div>
        <span className={styles.frozenTrail} aria-hidden="true" />
        <div className={clsx(styles.frozenCol, styles.frozenTarget)}>
          <span className={styles.frozenMeta}>
            {STATIC_FLOW.model} ·{' '}
            <Translate
              id="homepage.field.modelOutput"
              description="Label marking field text as a model output">
              MODEL OUTPUT
            </Translate>
          </span>
          <span className={styles.frozenText} lang={STATIC_FLOW.targetLang}>
            {STATIC_FLOW.target}
            <span className={styles.frozenChip}>
              corpus composite {STATIC_FLOW.composite}
            </span>
          </span>
          <span className={styles.frozenRef}>
            <Translate
              id="homepage.field.reference"
              description="Label for the gold reference translation">
              reference:
            </Translate>{' '}
            <span lang={STATIC_FLOW.targetLang}>{STATIC_FLOW.reference}</span>
          </span>
        </div>
      </figure>

      {/* Provenance legend — always-visible DOM text (claims honesty). */}
      <p className={styles.legend}>
        <Translate
          id="homepage.field.legend"
          description="Provenance legend for the translation field background">
          Real corpus sentences · real model outputs · each chip: that run’s whole-corpus composite score
        </Translate>
        <ProvenanceTip
          source="data/field.json — CC-BY Tatoeba dev-corpus entries with model outputs from published runs on the Arena scoreboard (Supabase run_cards / run_card_entries; gated to plain-CC-BY, non-held-out datasets — see CLAIMS.md §'The Translation Field'). The chip on each flow is the run's corpus-level composite score (scoring spec §4, 0–1) for that model × language pair — the score of the whole recorded run, not of the single sentence shown"
          date="2026-06-16"
        />
      </p>
    </div>
  );
}
