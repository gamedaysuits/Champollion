import React from 'react';
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import { useDoc, useDocsSidebar } from '@docusaurus/plugin-content-docs/client';
import styles from './RelatedRail.module.css';

/* ====================================================================
   RelatedRail — the "If this interested you →" onward-links rail that
   renders at the bottom of every doc page (mounted from the
   src/theme/DocItem/Footer wrapper).

   Sources, in priority order:
   1. Frontmatter `related:` — an array of editorially curated picks:

        related:
          - label: "Scoring Specification"
            to: /docs/specifications/scoring
            kind: spec
            note: "How the composite score is computed"

      `to` accepts internal paths (including anchors like
      /glossary#term-register) and full cross-site URLs (rendered with
      an ↗ marker). `kind` selects the chip label (see KIND_LABELS);
      `note` is an optional one-clause teaser.
   2. Fallback: up to four same-category sidebar siblings, so every doc
      page links onward even before it gets curated picks.

   Styling notes live in cli/website/DESIGN.md §5. (Single site since the
   Arena merge, 2026-06-20 — the former arena/website copy is retired.)
   ==================================================================== */

const MAX_CURATED = 5;
const MAX_FALLBACK = 4;

const KIND_LABELS = {
  doc: 'Docs',
  guide: 'Guide',
  concept: 'Concept',
  reference: 'Reference',
  tutorial: 'Tutorial',
  cookbook: 'Cookbook',
  spec: 'Spec',
  position: 'Position piece',
  glossary: 'Glossary',
  leaderboard: 'Leaderboard',
  card: 'Trading card',
  atlas: 'Atlas',
  arena: 'The Arena',
  champollion: 'champollion.dev',
};

/** Normalize a frontmatter `related:` array into {label, to, kind, note}. */
function normalizeRelated(related) {
  if (!Array.isArray(related)) return [];
  return related
    .map((entry) =>
      typeof entry === 'string' ? { label: entry, to: entry } : entry,
    )
    .filter((entry) => entry && entry.to && entry.label);
}

/**
 * Walk the sidebar tree and return the sibling doc links of `docId` —
 * the other links inside the category (or root list) that directly
 * contains the current doc.
 */
function findSiblings(items, docId) {
  const directLinks = items.filter((item) => item.type === 'link');
  if (directLinks.some((link) => link.docId === docId)) {
    return directLinks
      .filter((link) => link.docId !== docId)
      .map((link) => ({ label: link.label, to: link.href, kind: 'doc' }));
  }
  for (const item of items) {
    if (item.type === 'category') {
      const found = findSiblings(item.items, docId);
      if (found) return found;
    }
  }
  return null;
}

export default function RelatedRail() {
  const { metadata, frontMatter } = useDoc();
  const sidebar = useDocsSidebar();

  let entries = normalizeRelated(frontMatter.related).slice(0, MAX_CURATED);
  if (entries.length === 0 && sidebar?.items) {
    entries = (findSiblings(sidebar.items, metadata.id) || []).slice(
      0,
      MAX_FALLBACK,
    );
  }
  if (entries.length === 0) return null;

  return (
    <aside className={styles.rail} aria-labelledby="related-rail-title">
      <span className={styles.rule} aria-hidden="true" />
      <p className={styles.kicker} id="related-rail-title">
        <Translate
          id="theme.docs.relatedRail.title"
          description="Heading of the related-content rail at the bottom of a doc page">
          If this interested you →
        </Translate>
      </p>
      <ul className={styles.list}>
        {entries.map((entry) => {
          const isExternal = /^https?:\/\//.test(entry.to);
          return (
            <li key={entry.to} className={styles.item}>
              <Link to={entry.to} className={styles.card}>
                <span className={styles.kind}>
                  {KIND_LABELS[entry.kind] || KIND_LABELS.doc}
                </span>
                <span className={styles.label}>
                  {entry.label}
                  {isExternal && (
                    <span className={styles.ext} aria-hidden="true">
                      {' '}
                      ↗
                    </span>
                  )}
                </span>
                {entry.note && <span className={styles.note}>{entry.note}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
