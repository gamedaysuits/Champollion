/**
 * Tip — a generic, reusable hover/focus tooltip for badges, labels, numbers,
 * and short inline terms.
 *
 * It shares the visual grammar of GlossaryMark (dotted-underline term marks in
 * card prose) and ProvenanceTip (the ⓘ source affordance), but unlike those it
 * wraps ARBITRARY children — a complexity badge, a vitality dot, a metric label
 * — and shows a structured tooltip:
 *
 *   ┌──────────────────────────────┐
 *   │ TERM (optional, bold)        │
 *   │ plain-language body text     │
 *   │                  Glossary →  │  (optional link)
 *   └──────────────────────────────┘
 *
 * Pure CSS reveal (no portal): :hover / :focus-within on the host, so any link
 * inside stays reachable by mouse and keyboard. Placement is configurable so a
 * tip on a top-of-card badge can drop DOWN instead of being clipped above.
 *
 * For glossary terms that live in glossary.json, pass `href` pointing at the
 * /glossary anchor (use termAnchor()); for derived/composite concepts that have
 * a glossary entry too (MT complexity, data contamination) do the same. When a
 * concept has no glossary home, omit `href` and the link simply isn't rendered.
 */

import React from 'react';
import Link from '@docusaurus/Link';
import styles from './Tip.module.css';

export default function Tip({
  term,
  body,
  children,
  href,
  linkLabel = 'Glossary',
  placement = 'top', // 'top' | 'bottom'
  align = 'center', // 'center' | 'left' (opens right) | 'right' (opens left)
  className,
  stopClick = false, // swallow clicks so a tip inside a clickable card doesn't trigger it
}) {
  // Nothing to explain → render children untouched (graceful degradation).
  if (!term && !body) return children;

  const alignClass =
    align === 'left' ? styles.alignLeft : align === 'right' ? styles.alignRight : styles.alignCenter;

  return (
    <span
      className={`${styles.host} ${className || ''}`}
      tabIndex={0}
      onClick={stopClick ? (e) => e.stopPropagation() : undefined}
      onKeyDown={
        stopClick
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }
          : undefined
      }
    >
      {children}
      <span
        className={`${styles.bubble} ${placement === 'bottom' ? styles.bottom : styles.top} ${alignClass}`}
        role="tooltip"
      >
        {term && <span className={styles.term}>{term}</span>}
        {body && <span className={styles.body}>{body}</span>}
        {href && (
          <Link className={styles.more} to={href}>
            {linkLabel} →
          </Link>
        )}
      </span>
    </span>
  );
}
