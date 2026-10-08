import React from 'react';
import Translate, {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './spoke.module.css';

/* ====================================================================
   /research — "Researcher" spoke.
   The specifications index, corpora registry story, and the
   citation/licensing story. Numbers sourced in cli/website/CLAIMS.md.
   ==================================================================== */

const specs = () => [
  {
    title: translate({id: 'page.research.spec1', message: 'Benchmark specification', description: 'spec link'}),
    desc: translate({id: 'page.research.spec1Desc', message: 'What constitutes a valid run: datasets, fingerprints, run cards.', description: 'spec desc'}),
    href: '/docs/network/specifications/benchmark',
  },
  {
    title: translate({id: 'page.research.spec2', message: 'Scoring specification', description: 'spec link'}),
    desc: translate({id: 'page.research.spec2Desc', message: 'Composite score construction, metric definitions, quality tiers.', description: 'spec desc'}),
    href: '/docs/network/specifications/scoring',
  },
  {
    title: translate({id: 'page.research.spec3', message: 'Significance testing', description: 'spec link'}),
    desc: translate({id: 'page.research.spec3Desc', message: 'Bootstrap confidence intervals and paired comparison methodology.', description: 'spec desc'}),
    href: '/docs/network/specifications/significance',
  },
  {
    title: translate({id: 'page.research.spec4', message: 'Corpus design', description: 'spec link'}),
    desc: translate({id: 'page.research.spec4Desc', message: 'How evaluation corpora are built, versioned, and contamination-checked.', description: 'spec desc'}),
    href: '/docs/network/specifications/corpus-design',
  },
];

export default function ResearchPage() {
  // Counts from the machine SSOTs at build time (docusaurus.config.js
  // customFields: shared/licenses.json + arena/datasets/registry.json) —
  // never hardcoded, so they cannot drift when the sources regenerate.
  // See cli/website/CLAIMS.md.
  const {siteConfig} = useDocusaurusContext();
  const licensedSources = siteConfig.customFields.licensedSourceCount.toLocaleString('en-US');
  const registryDatasets = siteConfig.customFields.registryDatasetCount.toLocaleString('en-US');
  const catalogCards = siteConfig.customFields.catalogLanguageCount.toLocaleString('en-US');
  return (
    <Layout
      title={translate({id: 'page.research.seoTitle', message: 'Research', description: '/research SEO title'})}
      description={translate({id: 'page.research.seoDesc', message: 'Open specifications, versioned evaluation corpora, and a fully cited language-card dataset. Reproduce everything.', description: '/research SEO description'})}
    >
      <header className={styles.pageHeader}>
        <div className="container">
          <p className={styles.eyebrow}><Translate id="page.research.eyebrow" description="eyebrow">RESEARCHER</Translate></p>
          <Heading as="h1" className={styles.pageTitle}>
            <Translate id="page.research.title" description="h1">Reproduce everything</Translate>
          </Heading>
          <p className={styles.pageSubtitle}>
            <Translate id="page.research.subtitle" description="page subtitle">Every benchmark run is fingerprinted to a git commit. Every corpus is versioned and content-hashed. Every fact on every language card names its source. That's the whole methodology.</Translate>
          </p>
        </div>
      </header>

      <main className={styles.contentWrapper}>
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.research.specsHeading" description="section heading">Specifications</Translate>
          </Heading>
          <div className={styles.linkGrid}>
            {specs().map((spec) => (
              <Link key={spec.href} href={spec.href} className={styles.linkCard}>
                <div className={styles.linkCardTitle}>{spec.title} ↗</div>
                <p className={styles.linkCardDesc}>{spec.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.research.corpora" description="section heading">Corpora</Translate>
          </Heading>
          <p className={styles.sectionBody}>
            <Translate id="page.research.corporaBody" description="corpora body; {n} is the dataset count" values={{n: registryDatasets}}>{'The dataset registry tracks {n} fetch-from-source evaluation datasets, each with a license, provenance notes, and a do-not-train flag. Held-out test sets stay sealed; dev sets are open for iteration. Contamination findings are published, not buried — see the corpus design spec for the audit trail.'}</Translate>
          </p>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.research.citation" description="section heading">Citation & licensing</Translate>
          </Heading>
          <p className={styles.sectionBody}>
            <Translate id="page.research.citationBody" description="citation body; {n} source count, {field} code span" values={{n: licensedSources, field: <code>_fieldSources</code>}}>{'The language-card layer draws on {n} registered upstream sources — Glottolog, WALS, Grambank, PHOIBLE, Lexibank, and friends — each tracked with its license and attribution requirements. Cards record per-field provenance ({field}), so any fact can be traced, challenged, and corrected.'}</Translate>
          </p>
          <div className={styles.linkGrid}>
            <Link to="/docs/reference/language-card-citation-procedure" className={styles.linkCard}>
              <div className={styles.linkCardTitle}><Translate id="page.research.citeProc" description="link card">Citation procedure</Translate></div>
              <p className={styles.linkCardDesc}>
                <Translate id="page.research.citeProcDesc" description="link card desc">How facts enter a card and how sources are recorded.</Translate>
              </p>
            </Link>
            <Link to="/docs/reference/language-card-spec" className={styles.linkCard}>
              <div className={styles.linkCardTitle}><Translate id="page.research.cardSpec" description="link card">Language card spec</Translate></div>
              <p className={styles.linkCardDesc}>
                <Translate id="page.research.cardSpecDesc" description="link card desc; {n} is the card count" values={{n: catalogCards}}>{'The full schema for the {n}-card dataset.'}</Translate>
              </p>
            </Link>
          </div>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.research.touch" description="section heading">Get in touch</Translate>
          </Heading>
          <p className={styles.sectionBody}>
            <Translate id="page.research.touchBody" description="get-in-touch body; {gh}/{spec} are links" values={{
              gh: <Link href="https://github.com/gamedaysuits/Champollion/issues">GitHub</Link>,
              spec: <Link href="/docs/network/specifications/corpus-partnership"><Translate id="page.research.partnershipLink" description="link text">corpus partnership spec</Translate></Link>,
            }}>{'Collaboration, corpus partnerships, corrections, or skepticism — all welcome. Open an issue on {gh} or start with the {spec}.'}</Translate>
          </p>
        </section>
      </main>
    </Layout>
  );
}
