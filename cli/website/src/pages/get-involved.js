import React from 'react';
import Link from '@docusaurus/Link';
import Translate, {translate} from '@docusaurus/Translate';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './get-involved.module.css';

/**
 * /get-involved — THE funnel page (founder IA pare-down 2026-07-17).
 *
 * The four roles the project needs — developers, sponsors, corpora
 * builders, community coordinators — each with what we need, the first
 * step, and links onward to the working surfaces. The homepage funnel
 * cards, the hero "Get involved" CTA, and the announcement-bar beta CTA
 * all land here.
 *
 * The non-commercial promise is stated up top and MUST stay consistent
 * with docs/network/sovereignty/economic-model.md (the docs twin).
 */

const roles = () => [
  {
    id: 'developers',
    icon: '⚙',
    title: translate({id: 'getInvolved.role.developers', message: 'Developers', description: '/get-involved role title'}),
    need: translate({id: 'getInvolved.role.developersNeed', message: 'Most of the ~6,500 uncovered languages will only get a translator if someone builds it. We need method builders (take on a hard language pair, get scored on open benchmarks), tooling contributors (the CLI, the eval harness, this site), and compute donors who run the public benchmark queue with their own API keys.', description: '/get-involved role need paragraph'}),
    steps: [
      {label: translate({id: 'getInvolved.step.how-the-network-works', message: 'How the Network works', description: '/get-involved step link label'}), to: '/arena'},
      {label: translate({id: 'getInvolved.step.submit-a-method', message: 'Submit a method', description: '/get-involved step link label'}), to: '/docs/network/getting-started/submit-a-method'},
      {label: translate({id: 'getInvolved.step.submit-to-the-index-datasets-resources-r', message: 'Submit to the index (datasets, resources, results)', description: '/get-involved step link label'}), to: '/docs/network/getting-started/submit-to-the-index'},
      {label: translate({id: 'getInvolved.step.run-the-public-queue-contribute-compute', message: 'Run the public queue (contribute compute)', description: '/get-involved step link label'}), to: '/contribute'},
      {label: translate({id: 'getInvolved.step.the-code-on-github', message: 'The code, on GitHub', description: '/get-involved step link label'}), href: 'https://github.com/gamedaysuits/Champollion'},
    ],
  },
  {
    id: 'sponsors',
    icon: '◈',
    title: translate({id: 'getInvolved.role.sponsors', message: 'Sponsors', description: '/get-involved role title'}),
    need: translate({id: 'getInvolved.role.sponsorsNeed', message: 'Corpus building is the bottleneck: a language cannot get a translator without recorded, licensed text — and building that corpus takes paid, skilled community work. CSR programs, foundations, and government language bodies can sponsor a specific language’s corpus, a language pair — like adopting a stretch of highway — benchmark bounties, or shared tooling. Every dollar is pass-through: it funds speakers, corpus builders, and prize winners, publicly accounted — Champollion is non-commercial and takes nothing.', description: '/get-involved role need paragraph'}),
    steps: [
      {label: translate({id: 'getInvolved.step.write-to-us-sponsor-a-language', message: 'Write to us — sponsor a language', description: '/get-involved step link label'}), href: 'mailto:info@champollion.dev'},
      {label: translate({id: 'getInvolved.step.the-economic-model-where-money-goes', message: 'The economic model (where money goes)', description: '/get-involved step link label'}), to: '/docs/network/sovereignty/economic-model'},
      {label: translate({id: 'getInvolved.step.who-benefits-if-this-works', message: 'Who benefits if this works', description: '/get-involved step link label'}), to: '/docs/network/who-benefits'},
    ],
  },
  {
    id: 'corpora',
    icon: '🛡',
    title: translate({id: 'getInvolved.role.corpora', message: 'Corpora builders', description: '/get-involved role title'}),
    need: translate({id: 'getInvolved.role.corporaNeed', message: 'A working evaluation set is about a thousand pairs — small enough to curate professionally, where a training corpus of hundreds of thousands never can be — and once it exists, every method in the world can be measured against your standard. Your data stays yours (sovereignty-aspirant): you choose the license, you can keep a sealed test set only your community holds, and nothing is scraped, ever.', description: '/get-involved role need paragraph'}),
    steps: [
      {label: translate({id: 'getInvolved.step.bring-your-language', message: 'Bring your language', description: '/get-involved step link label'}), to: '/my-language'},
      {label: translate({id: 'getInvolved.step.why-a-small-eval-set-beats-a-big-trainin', message: 'Why a small eval set beats a big training corpus', description: '/get-involved step link label'}), to: '/docs/network/who-benefits#researchers'},
      {label: translate({id: 'getInvolved.step.the-partnership-workflow-end-to-end', message: 'The partnership workflow, end to end', description: '/get-involved step link label'}), to: '/docs/network/specifications/corpus-partnership'},
      {label: translate({id: 'getInvolved.step.registering-a-corpus-step-by-step', message: 'Registering a corpus, step by step', description: '/get-involved step link label'}), to: '/docs/network/sovereignty/registering-corpora'},
      {label: translate({id: 'getInvolved.step.post-a-prize-against-your-test-set', message: 'Post a prize against your test set', description: '/get-involved step link label'}), to: '/docs/network/specifications/prizes'},
    ],
  },
  {
    id: 'coordinators',
    icon: '⚭',
    title: translate({id: 'getInvolved.role.coordinators', message: 'Community coordinators', description: '/get-involved role title'}),
    need: translate({id: 'getInvolved.role.coordinatorsNeed', message: 'NGOs, cultural organizations, and local institutions make the connection: they know the speaker communities, can convene corpus projects, and can host shared benchmark tasks for their region. If you work with language communities, you are the bridge this project is missing.', description: '/get-involved role need paragraph'}),
    steps: [
      {label: translate({id: 'getInvolved.step.for-language-communities-start-here', message: 'For language communities — start here', description: '/get-involved step link label'}), to: '/docs/network/community/for-language-communities'},
      {label: translate({id: 'getInvolved.step.host-a-shared-task', message: 'Host a shared task', description: '/get-involved step link label'}), to: '/shared-tasks'},
      {label: translate({id: 'getInvolved.step.fix-what-a-card-says-about-your-language', message: 'Fix what a card says about your language', description: '/get-involved step link label'}), to: '/docs/network/getting-started/submit-to-the-index'},
      {label: translate({id: 'getInvolved.step.talk-to-us-about-coordinating', message: 'Talk to us about coordinating', description: '/get-involved step link label'}), href: 'mailto:info@champollion.dev'},
    ],
  },
];

export default function GetInvolvedPage() {
  // The role anchors (#developers, #sponsors, …) live on plain <section>
  // elements, which Docusaurus's broken-anchor checker can't see in a React
  // page — declare them so docs links like /get-involved#sponsors validate.
  const brokenLinks = useBrokenLinks();
  const ROLES = roles();
  ROLES.forEach((r) => brokenLinks.collectAnchor(r.id));
  return (
    <Layout
      title={translate({id: 'getInvolved.seoTitle', message: 'Get involved', description: '/get-involved SEO title'})}
      description={translate({id: 'getInvolved.seoDesc', message: 'Champollion needs developers, sponsors, corpora builders, and community coordinators. Non-commercial: every sponsorship dollar builds corpora and tools — none of it goes to us.', description: '/get-involved SEO description'})}
    >
      <header className={styles.pageHeader}>
        <div className="container">
          <p className={styles.eyebrow}>
            <Translate id="getInvolved.eyebrow" description="Get-involved page eyebrow">
              BUILD IT WITH US
            </Translate>
          </p>
          <Heading as="h1" className={styles.pageTitle}>
            <Translate id="getInvolved.title" description="Get-involved page title">
              Get involved
            </Translate>
          </Heading>
          <p className={styles.pageSubtitle}>
            <Translate id="getInvolved.subtitle" description="Get-involved page subtitle">
              Fewer than 600 of the world’s 7,077 living languages have any
              machine translation. Closing that gap takes four kinds of help —
              and none of it makes us money.
            </Translate>
          </p>
          <p className={styles.ncBanner}>
            <Translate id="getInvolved.nc" description="Get-involved NC banner">
              Champollion is a non-commercial, source-available research
              project — free for noncommercial use, its evaluation harness
              open source.
              Sponsorship funds corpus building, tooling, and community work —
              publicly accounted, none of it to us. Communities keep ownership
              of their data, and every fact on this site cites its source.
            </Translate>
          </p>
        </div>
      </header>

      <main className={styles.contentWrapper}>
        {ROLES.map((r) => (
          <section key={r.id} id={r.id} className={styles.roleSection}>
            <Heading as="h2" className={styles.roleTitle}>
              <span className={styles.roleIcon} aria-hidden="true">
                {r.icon}
              </span>
              {r.title}
            </Heading>
            <p className={styles.roleNeed}>{r.need}</p>
            <ul className={styles.roleSteps}>
              {r.steps.map((s) =>
                s.to ? (
                  <li key={s.label}>
                    <Link to={s.to}>{s.label} →</Link>
                  </li>
                ) : (
                  <li key={s.label}>
                    <Link href={s.href}>{s.label} →</Link>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}

        <section className={styles.contactBand}>
          <p>
            <Translate id="getInvolved.contact" description="Get-involved contact band">
              Not sure where you fit? Write to us —
            </Translate>{' '}
            <Link href="mailto:info@champollion.dev">info@champollion.dev</Link>
            {' · '}
            <Link href="https://github.com/gamedaysuits/Champollion/issues">
              <Translate id="getInvolved.issues" description="Get-involved issues link">
                or open an issue
              </Translate>
            </Link>
          </p>
        </section>
      </main>
    </Layout>
  );
}
