/**
 * GlossaryMark — a subtle dotted-underline span around a glossary term in
 * card prose. Hover (or keyboard focus / tap on touch devices) reveals a
 * tooltip with the term's plain-language definition and a "More →" link to
 * its anchor on /glossary.
 *
 * Pure CSS tooltip (no portal): shown via :hover / :focus-within on the
 * wrapper, so the link inside stays reachable by mouse and keyboard.
 */

import React from 'react';
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import styles from './GlossaryMark.module.css';
import { termAnchor } from '../utils/explainerLoader';

export default function GlossaryMark({ entry, children }) {
  if (!entry) return children;

  return (
    <span className={styles.mark} tabIndex={0}>
      {children}
      <span className={styles.tooltip} role="tooltip">
        {/* termDisplay = localized name (localized glossary datasets only);
            the anchor stays keyed to the canonical English term. */}
        <span className={styles.tooltipTerm}>{entry.termDisplay || entry.term}</span>
        <span className={styles.tooltipPlain}>{entry.plain}</span>
        <Link
          className={styles.tooltipMore}
          to={`/glossary#${termAnchor(entry.term)}`}
        >
          <Translate
            id="glossary.mark.more"
            description="Glossary tooltip link to the term's full entry on the /glossary page"
          >
            More →
          </Translate>
        </Link>
      </span>
    </span>
  );
}
