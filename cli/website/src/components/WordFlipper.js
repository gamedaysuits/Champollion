import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import styles from './WordFlipper.module.css';

/**
 * WordFlipper — the "decipherment" morph.
 *
 * Cycles a word through languages/scripts with a soft ink-to-ink morph
 * (opacity + blur + lift; transform/opacity only, 60fps-safe).
 *
 * Each entry in `words` can be:
 *   - A plain string: rendered as-is
 *   - An object { text, script?, lang?, dir? }:
 *       script — sets <span data-script="..."> so PUA @font-face rules
 *                (Klingon pIqaD, Tengwar) activate
 *       lang   — BCP-47 tag for the rendered word (screen readers,
 *                font selection)
 *       dir    — 'rtl' for Arabic-script entries
 *
 * Accessibility / motion:
 *   - Under prefers-reduced-motion the flipper renders the FIRST word,
 *     statically — no cycling, no DOM churn. (Live and reactive to the
 *     OS setting.)
 *   - The cycling span is aria-hidden with a stable aria-label on the
 *     container, so screen readers hear one sentence, not a slideshow.
 *
 * The `onChange` callback receives the raw word entry (string or object)
 * so the parent can inspect it (e.g., to check if it's a number).
 */

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

export default function WordFlipper({
  words = [],
  interval = 2600,
  className = '',
  wordClassName = '',
  ariaLabel = null,
  onChange = null,
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const reduced = useReducedMotion();
  // Mirrors `index` so the timeout can compute the next index without a
  // setState updater — updaters run during render and must stay pure, so
  // `onChange` (which may setState in the parent) cannot live inside one.
  const indexRef = useRef(0);

  useEffect(() => {
    if (words.length <= 1 || reduced) return undefined;

    let changeTimer = null;
    const timer = setInterval(() => {
      // Step 1: Trigger transition-out
      setVisible(false);

      // Step 2: Swap content midpoint during transition
      changeTimer = setTimeout(() => {
        const nextIndex = (indexRef.current + 1) % words.length;
        indexRef.current = nextIndex;
        setIndex(nextIndex);
        if (onChange) {
          onChange(words[nextIndex], nextIndex);
        }

        // Step 3: Trigger transition-in
        setVisible(true);
      }, 280);
    }, interval);

    return () => {
      clearInterval(timer);
      clearTimeout(changeTimer);
    };
  }, [words, interval, onChange, reduced]);

  if (words.length === 0) return null;

  // Reduced motion: a still, dignified first word.
  const currentWord = reduced ? words[0] : words[index];
  const isObj = typeof currentWord === 'object' && currentWord !== null;
  const text = isObj ? currentWord.text : currentWord;
  const lang = isObj ? currentWord.lang : undefined;
  const dir = isObj ? currentWord.dir : undefined;
  const script = isObj ? currentWord.script : undefined;

  return (
    <span
      className={clsx(styles.flipperContainer, className)}
      aria-label={ariaLabel || undefined}
      role={ariaLabel ? 'img' : undefined}
    >
      <span
        aria-hidden={ariaLabel ? 'true' : undefined}
        className={clsx(
          styles.flipperWrapper,
          (visible || reduced) && styles.flipperWrapperVisible,
          wordClassName
        )}
        lang={lang}
        dir={dir}
        data-script={script}
      >
        {text}
      </span>
    </span>
  );
}
