import React from 'react';
import Translate, {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';

import styles from './spoke.module.css';

/* ====================================================================
   /my-language — "Guardian" spoke.
   Warm, plain-language landing for speakers and communities.
   sovereignty-aspirant: links to the canonical public docs on champollion.dev
   rather than restating them. Deliberately makes NO promises about
   programs that don't exist yet.
   ==================================================================== */

const docLinks = () => [
  {
    title: translate({id: 'page.myLanguage.link1', message: 'For language communities', description: '/my-language doc link title'}),
    desc: translate({id: 'page.myLanguage.link1Desc', message: 'What this project is, in plain language — and what it asks of no one.', description: '/my-language doc link desc'}),
    href: '/docs/network/community/for-language-communities',
  },
  {
    title: translate({id: 'page.myLanguage.link2', message: 'Data sovereignty', description: '/my-language doc link title'}),
    desc: translate({id: 'page.myLanguage.link2Desc', message: 'How Indigenous data-sovereignty principles, CARE, and Māori Data Sovereignty shape the platform.', description: '/my-language doc link desc'}),
    href: '/docs/network/sovereignty/data-sovereignty',
  },
  {
    title: translate({id: 'page.myLanguage.link3', message: 'Ownership transfer', description: '/my-language doc link title'}),
    desc: translate({id: 'page.myLanguage.link3Desc', message: 'The plan for handing methods and infrastructure to the communities they serve.', description: '/my-language doc link desc'}),
    href: '/docs/network/sovereignty/ownership-transfer',
  },
];

export default function MyLanguagePage() {
  return (
    <Layout
      title={translate({id: 'page.myLanguage.seoTitle', message: 'Your Language', description: '/my-language SEO title'})}
      description={translate({id: 'page.myLanguage.seoDesc', message: 'Your language, your data, your decisions. How speakers and communities can explore, correct, and govern the technology built around their language.', description: '/my-language SEO description'})}
    >
      <header className={styles.pageHeader}>
        <div className="container">
          <p className={styles.eyebrow}><Translate id="page.myLanguage.eyebrow" description="/my-language eyebrow">GUARDIAN</Translate></p>
          <Heading as="h1" className={styles.pageTitle}>
            <Translate id="page.myLanguage.title" description="/my-language h1">Your language. Your data. Your call.</Translate>
          </Heading>
          <p className={styles.pageSubtitle}>
            <Translate id="page.myLanguage.subtitle" description="/my-language subtitle">If you speak a language that big tech ignores, this project was built with you in mind — and built so that you stay in charge of it.</Translate>
          </p>
        </div>
      </header>

      <main className={styles.contentWrapper}>
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.myLanguage.believe" description="section heading">What we believe</Translate>
          </Heading>
          <div className={styles.principleList}>
            <div className={styles.principle}>
              <div className={styles.principleTitle}><Translate id="page.myLanguage.p1" description="principle title">Your data stays yours</Translate></div>
              <p className={styles.principleText}>
                <Translate id="page.myLanguage.p1Text" description="principle text">Community-contributed corpora carry do-not-train flags and the licenses their owners choose. We build to First Nations data-sovereignty principles — community ownership and control of language data — and the CARE principles — they're design constraints here, not a press release.</Translate>
              </p>
            </div>
            <div className={styles.principle}>
              <div className={styles.principleTitle}>
                <Translate id="page.myLanguage.p2" description="principle title">Methods built with community knowledge belong to the community</Translate>
              </div>
              <p className={styles.principleText}>
                <Translate id="page.myLanguage.p2Text" description="principle text">If a translation method only works because speakers shared their grammar, their dictionaries, or their time, the community has a standing claim on it. The ownership-transfer documentation spells out how that is meant to work.</Translate>
              </p>
            </div>
            <div className={styles.principle}>
              <div className={styles.principleTitle}><Translate id="page.myLanguage.p3" description="principle title">Every fact is cited</Translate></div>
              <p className={styles.principleText}>
                <Translate id="page.myLanguage.p3Text" description="principle text">Each language card records where every fact came from — and that means every fact can be challenged and corrected by the people who actually speak the language. You are the authority on your language; we are not.</Translate>
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.myLanguage.start" description="section heading">How to start</Translate>
          </Heading>
          <ol className={styles.steps}>
            <li className={styles.step}>
              <span className={styles.stepNumber}>1</span>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}><Translate id="page.myLanguage.s1" description="step title">Look up your language's card</Translate></div>
                <p className={styles.stepText}>
                  <Translate id="page.myLanguage.s1Text" description="step text">See what the public record says about your language — names, vitality, scripts, resources — and what it gets wrong.</Translate>{' '}
                  <Link to="/languages"><Translate id="page.myLanguage.s1Link" description="step link">Find your language →</Translate></Link>
                </p>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}><Translate id="page.myLanguage.s2" description="step title">Tell us what's wrong (or missing)</Translate></div>
                <p className={styles.stepText}>
                  <Translate
                    id="page.myLanguage.s2Text"
                    description="step text; {github}/{email}/{tatoeba} are links"
                    values={{
                      github: <Link href="https://github.com/gamedaysuits/Champollion/issues">GitHub</Link>,
                      email: <Link href="mailto:info@champollion.dev">info@champollion.dev</Link>,
                      tatoeba: <Link href="https://tatoeba.org">Tatoeba</Link>,
                    }}>
                    {'Corrections from speakers outrank any database we ingest. Open an issue on {github} or email {email} — no technical background needed, plain words are perfect. And if you want to put your language on the map today: sentences you add to {tatoeba} can become benchmark data here at the next corpus build — we never collect corpora ourselves.'}
                  </Translate>
                </p>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNumber}>3</span>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}><Translate id="page.myLanguage.s3" description="step title">Shape what gets built</Translate></div>
                <p className={styles.stepText}>
                  <Translate id="page.myLanguage.s3Text" description="step text">Benchmarks for your language should be reviewed by people who speak it. If you want your community involved in that review — on your terms — start with the community documentation below and reach out.</Translate>
                </p>
              </div>
            </li>
          </ol>
          <p className={styles.note}>
            <Translate id="page.myLanguage.note" description="honesty note">Contests and community programs are in development. We won't announce them here until they're real.</Translate>
          </p>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.myLanguage.readMore" description="section heading">Read more</Translate>
          </Heading>
          <div className={styles.linkGrid}>
            {docLinks().map((link) => (
              <Link key={link.href} href={link.href} className={styles.linkCard}>
                <div className={styles.linkCardTitle}>{link.title} ↗</div>
                <p className={styles.linkCardDesc}>{link.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}
