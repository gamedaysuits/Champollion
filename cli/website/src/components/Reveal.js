import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';
import styles from './Reveal.module.css';

/**
 * Reveal — scroll-triggered section entrance.
 *
 * Wraps a block; when it enters the viewport it fades/rises in once
 * (IntersectionObserver + CSS transition, transform/opacity only).
 *
 * Progressive enhancement contract:
 *   - SSR/no-JS: content renders fully visible (the hidden state is only
 *     applied from JS, after hydration).
 *   - prefers-reduced-motion: never hidden, never animated.
 *   - Already-visible elements reveal immediately (no scroll required).
 *
 * Props:
 *   as        — wrapper element (default 'div')
 *   delay     — transition-delay in ms (stagger siblings)
 *   className — merged onto the wrapper
 */
export default function Reveal({
  as: Tag = 'div',
  delay = 0,
  className,
  children,
  ...rest
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return undefined; // stay visible, no motion
    }

    el.setAttribute('data-reveal', 'pending');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          el.setAttribute('data-reveal', 'in');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={clsx(styles.reveal, className)}
      style={delay ? { '--reveal-delay': `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
