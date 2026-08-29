import React, { useState, useMemo, useEffect } from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useLocation } from '@docusaurus/router';
import useBrokenLinks from '@docusaurus/useBrokenLinks';

import spokeStyles from './spoke.module.css';
import styles from './glossary.module.css';
import { termAnchor, loadGlossary } from '../utils/explainerLoader';
// Static import (not the runtime loader): the SSOT JSON is bundled at build
// time so every term card — and every #term-<slug> anchor — exists in the
// SSG HTML. Deep links from docs pages (e.g. /glossary#term-register) land
// without JS, and the broken-anchor checker can verify them.
import glossaryData from '@site/data/explainers/glossary.json';

/* ====================================================================
   /glossary — plain-language definitions for every technical term the
   language cards use. Data: data/explainers/glossary.json (curated in
   cli/shared/explainers/), statically imported so all terms + anchors
   are in the SSG HTML. Deep-linkable: #term-<slug> (docs RelatedRail
   and the cookbooks link here). Card prose links here via
   GlossaryMark "More →" tooltips.

   Localization: definitions are champollion-translated (see
   plugins/shared-data/mergeGlossaryLocale.js for the pipeline). On
   translated locales the page hydrates with the English SSG copy, then
   overlays data/explainers/glossary.<locale>.json at runtime — the
   canonical English `term` (anchors, sort order, A–Z grouping, related
   cross-references) never changes, only the display strings do.
   ==================================================================== */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Group letter for a term — A–Z, or '#' for anything else. Always keyed on
 *  the canonical English term so the index is identical in every locale. */
function groupLetter(term) {
  const first = String(term).charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

function TermCard({ entry, displayByTerm, onNavigateToTerm }) {
  const display = entry.termDisplay || entry.term;
  return (
    <article className={styles.termCard} id={termAnchor(entry.term)}>
      <div className={styles.termHeader}>
        <Heading as="h3" className={styles.termName}>
          {display}
          {display !== entry.term && (
            <>
              {' '}
              <span className={styles.termCanonical}>({entry.term})</span>
            </>
          )}
        </Heading>
        <a
          className={styles.termAnchorLink}
          href={`#${termAnchor(entry.term)}`}
          aria-label={translate(
            {
              id: 'glossary.page.termAnchorAriaLabel',
              message: 'Link to {term}',
              description: 'ARIA label of the # anchor link next to a glossary term',
            },
            { term: entry.term }
          )}
        >
          #
        </a>
      </div>

      {entry.also?.length > 0 && (
        <p className={styles.termAlso}>
          <Translate
            id="glossary.page.alsoLabel"
            description="Label before the list of alternate surface forms of a glossary term (the variants themselves stay in English — they mirror the English card prose)"
          >
            also:
          </Translate>{' '}
          {entry.also.join(' · ')}
        </p>
      )}

      <p className={styles.termPlain}>{entry.plain}</p>

      {entry.mt_relevance && (
        <p className={styles.termMt}>
          <strong>
            <Translate
              id="glossary.page.mtRelevanceLabel"
              description="Label before the note on why a glossary term matters for machine translation"
            >
              Why it matters for MT:
            </Translate>
          </strong>{' '}
          {entry.mt_relevance}
        </p>
      )}

      {entry.example && (
        <p className={styles.termExample}>
          <strong>
            <Translate
              id="glossary.page.exampleLabel"
              description="Label before a glossary term's example"
            >
              Example:
            </Translate>
          </strong>{' '}
          {entry.example}
        </p>
      )}

      {(entry.citations?.length > 0 || entry.related?.length > 0) && (
        <div className={styles.termFooter}>
          {entry.citations?.length > 0 && (
            <span className={styles.termCitations}>
              {entry.citations.map((cite, i) => (
                <a
                  key={i}
                  href={cite.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.termCitation}
                >
                  {cite.source} ↗
                </a>
              ))}
            </span>
          )}
          {entry.related?.length > 0 && (
            <span className={styles.termRelated}>
              <span className={styles.termRelatedLabel}>
                <Translate
                  id="glossary.page.relatedLabel"
                  description="Label before the list of related glossary terms"
                >
                  Related:
                </Translate>
              </span>
              {entry.related.map((rel) => (
                <a
                  key={rel}
                  href={`#${termAnchor(rel)}`}
                  className={styles.termRelatedTag}
                  onClick={() => onNavigateToTerm?.()}
                >
                  {displayByTerm?.get(rel) || rel}
                </a>
              ))}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

export default function GlossaryPage() {
  const location = useLocation();
  const brokenLinks = useBrokenLinks();
  const {
    i18n: { currentLocale },
  } = useDocusaurusContext();
  const [search, setSearch] = useState('');
  // Localized dataset (translated locales only) — overlays the bundled
  // English copy after hydration. _meta.locale distinguishes a real
  // localized artifact from the loader's English fallback.
  const [localized, setLocalized] = useState(null);

  useEffect(() => {
    if (currentLocale === 'en') return undefined;
    let cancelled = false;
    loadGlossary(currentLocale).then((data) => {
      if (
        !cancelled &&
        data &&
        Array.isArray(data.terms) &&
        data.terms.length > 0 &&
        data._meta?.locale === currentLocale
      ) {
        setLocalized(data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentLocale]);

  const terms = useMemo(() => {
    const list = localized?.terms || glossaryData?.terms || [];
    // Canonical (English) sort in every locale: the A–Z index, anchors and
    // deep links stay identical across the 13 builds.
    return [...list].sort((a, b) => a.term.localeCompare(b.term));
  }, [localized]);

  // Canonical term → localized display name, for related-term cross-links.
  const displayByTerm = useMemo(
    () => new Map(terms.map((t) => [t.term, t.termDisplay || t.term])),
    [terms]
  );

  // Register every #term-<slug> anchor with the broken-anchor checker so
  // docs pages (RelatedRail, cookbooks) can deep-link to glossary terms
  // and the build verifies those links. No-op at runtime. Anchors come from
  // the bundled English copy — canonical terms, identical in every locale.
  for (const t of glossaryData?.terms || []) brokenLinks.collectAnchor(termAnchor(t.term));

  // Search filter — matches term (canonical + localized), surface variants,
  // and definition text.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        (t.termDisplay || '').toLowerCase().includes(q) ||
        (t.also || []).some((a) => a.toLowerCase().includes(q)) ||
        (t.plain || '').toLowerCase().includes(q) ||
        (t.mt_relevance || '').toLowerCase().includes(q)
    );
  }, [terms, search]);

  // Group filtered terms by first letter for the alphabet index.
  const grouped = useMemo(() => {
    const groups = {};
    for (const t of filtered) {
      const letter = groupLetter(t.term);
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(t);
    }
    return groups;
  }, [filtered]);

  const lettersWithTerms = useMemo(
    () => new Set(terms.map((t) => groupLetter(t.term))),
    [terms]
  );

  // Deep links (#term-slug): native anchor scroll covers full page loads
  // (the anchors are in the SSG HTML); this effect covers SPA navigations.
  useEffect(() => {
    if (terms.length === 0 || !location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    // Allow the term cards to mount first.
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    });
  }, [terms, location.hash]);

  return (
    <Layout
      title={translate({
        id: 'glossary.page.metaTitle',
        message: 'Glossary',
        description: 'The browser/meta title of the /glossary page',
      })}
      description={translate({
        id: 'glossary.page.metaDescription',
        message:
          'Plain-language definitions of the linguistic terms used across the language cards — morphology, tone, evidentiality, and why each one matters for machine translation.',
        description: 'The meta description of the /glossary page',
      })}
    >
      <header className={spokeStyles.pageHeader}>
        <div className="container">
          <p className={spokeStyles.eyebrow}>
            <Translate id="glossary.page.eyebrow" description="Eyebrow label above the /glossary page title">
              GLOSSARY
            </Translate>
          </p>
          <Heading as="h1" className={spokeStyles.pageTitle}>
            <Translate id="glossary.page.title" description="The /glossary page title">
              The linguistics, in plain language
            </Translate>
          </Heading>
          <p className={spokeStyles.pageSubtitle}>
            <Translate
              id="glossary.page.subtitle"
              description="The /glossary page subtitle; {count} is the number of terms"
              values={{ count: terms.length }}
            >
              {
                'Every technical term the language cards use — what it means, and why it makes machine translation harder. {count} terms, each with a citation to the standard reference.'
              }
            </Translate>
          </p>
        </div>
      </header>

      <main className={spokeStyles.contentWrapper}>
        {/* Search */}
        <div className={styles.searchWrap}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder={translate(
              {
                id: 'glossary.page.searchPlaceholder',
                message: 'Search {count} terms…',
                description: 'Placeholder of the /glossary search input; {count} is the number of terms',
              },
              { count: terms.length || '' }
            )}
            aria-label={translate({
              id: 'glossary.page.searchAriaLabel',
              message: 'Search glossary terms',
              description: 'ARIA label of the /glossary search input',
            })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearch('')}
              aria-label={translate({
                id: 'glossary.page.searchClearAriaLabel',
                message: 'Clear search',
                description: 'ARIA label of the /glossary search clear button',
              })}
            >
              ✕
            </button>
          )}
        </div>

        {/* Alphabet index */}
        <nav
          className={styles.alphabetIndex}
          aria-label={translate({
            id: 'glossary.page.alphabetAriaLabel',
            message: 'Alphabet index',
            description: 'ARIA label of the /glossary A–Z index',
          })}
        >
          {ALPHABET.map((letter) =>
            lettersWithTerms.has(letter) && grouped[letter] ? (
              <a key={letter} href={`#letter-${letter}`} className={styles.alphaLink}>
                {letter}
              </a>
            ) : (
              <span key={letter} className={styles.alphaDisabled}>
                {letter}
              </span>
            )
          )}
        </nav>

        {/* States */}
        {terms.length > 0 && filtered.length === 0 && (
          <p className={styles.emptyState}>
            <Translate
              id="glossary.page.emptyState"
              description="Shown when the /glossary search matches nothing; {query} is the search text"
              values={{ query: search }}
            >
              {'No terms match “{query}”.'}
            </Translate>
          </p>
        )}

        {/* Term groups */}
        {Object.keys(grouped)
          .sort()
          .map((letter) => (
            <section key={letter} className={styles.letterGroup} id={`letter-${letter}`}>
              <Heading as="h2" className={styles.letterHeading}>
                {letter}
              </Heading>
              <div className={styles.termList}>
                {grouped[letter].map((entry) => (
                  <TermCard
                    key={entry.term}
                    entry={entry}
                    displayByTerm={displayByTerm}
                    onNavigateToTerm={() => setSearch('')}
                  />
                ))}
              </div>
            </section>
          ))}

        {/* Where these terms surface */}
        <section className={spokeStyles.section}>
          <p className={spokeStyles.note}>
            <Translate
              id="glossary.page.whereTheseSurface"
              description="Footer note on the /glossary page; {atlasLink} and {catalogueLink} are links"
              values={{
                atlasLink: (
                  <Link to="/languages">
                    <Translate
                      id="glossary.page.whereTheseSurface.atlasLink"
                      description="Link text (the Atlas) inside the /glossary footer note"
                    >
                      the Atlas
                    </Translate>
                  </Link>
                ),
                catalogueLink: (
                  <Link to="/languages">
                    <Translate
                      id="glossary.page.whereTheseSurface.catalogueLink"
                      description="Link text (language atlas) inside the /glossary footer note"
                    >
                      language atlas
                    </Translate>
                  </Link>
                ),
              }}
            >
              {
                'These terms are marked with a dotted underline wherever they appear in card prose — hover one on any card in {atlasLink} or the {catalogueLink} for the short version, then follow “More →” back here.'
              }
            </Translate>
          </p>
        </section>
      </main>
    </Layout>
  );
}
