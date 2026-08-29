import React from 'react';
import Translate, {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';

import styles from './spoke.module.css';

/* ====================================================================
   /translate — "Translator" spoke.
   Landing page for the CLI path: install, three-step quickstart
   (init → key → sync, matching docs/getting-started/quick-start.md),
   the ten-method matrix mention, and links into the docs.
   ==================================================================== */

export default function TranslatePage() {
  return (
    <Layout
      title={translate({id: 'page.translate.seoTitle', message: 'Translate Your App', description: '/translate SEO title'})}
      description={translate({id: 'page.translate.seoDesc', message: 'Translate your locale files with one command. Ten translation methods — Google Translate, LLMs, coached pipelines, custom APIs — each language pair picks its own.', description: '/translate SEO description'})}
    >
      <header className={styles.pageHeader}>
        <div className="container">
          <p className={styles.eyebrow}><Translate id="page.translate.eyebrow" description="/translate eyebrow">TRANSLATOR</Translate></p>
          <Heading as="h1" className={styles.pageTitle}>
            <Translate id="page.translate.title" description="/translate h1">One command. Every locale.</Translate>
          </Heading>
          <p className={styles.pageSubtitle}>
            <Translate id="page.translate.subtitle" description="/translate subtitle">champollion translates your app's locale files — JSON, TOML, YAML, Markdown — with per-language-pair control over method, model, and quality. Runs anywhere Node 20+ does.</Translate>{' '}
            <Link to="/human-services"><Translate id="page.translate.humanLink" description="/translate human-translator link">Need a human translator instead? →</Translate></Link>
          </p>
        </div>
      </header>

      <main className={styles.contentWrapper}>
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.translate.install" description="/translate install heading">Install</Translate>
          </Heading>
          <CodeBlock language="bash">npm i -g champollion</CodeBlock>
          <p className={styles.note}>
            <Translate id="page.translate.adhoc" description="/translate ad hoc note" values={{cmd: <code>npx champollion</code>}}>{'Or run it ad hoc with {cmd}.'}</Translate>
          </p>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.translate.threeSteps" description="/translate steps heading">Three steps to translated</Translate>
          </Heading>
          <ol className={styles.steps}>
            <li className={styles.step}>
              <span className={styles.stepNumber}>1</span>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}><Translate id="page.translate.step1" description="step 1 title">Initialize</Translate></div>
                <p className={styles.stepText}>
                  <Translate id="page.translate.step1Text" description="step 1 text" values={{cfg: <code>champollion.config.json</code>}}>{'The wizard detects your locale files, source language, and formats, then writes {cfg}.'}</Translate>
                </p>
                <CodeBlock language="bash">champollion init</CodeBlock>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}><Translate id="page.translate.step2" description="step 2 title">Configure a provider</Translate></div>
                <p className={styles.stepText}>
                  <Translate id="page.translate.step2Text" description="step 2 text">One key is enough to start — OpenRouter reaches 200+ models, or use Gemini's free tier.</Translate>
                </p>
                <CodeBlock language="bash">{`export OPENROUTER_API_KEY=sk-or-v1-...
# or: export GEMINI_API_KEY=AI...`}</CodeBlock>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNumber}>3</span>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}><Translate id="page.translate.step3" description="step 3 title">Sync</Translate></div>
                <p className={styles.stepText}>
                  <Translate id="page.translate.step3Text" description="step 3 text">Translates what changed, skips what didn't, validates every string through the quality gate before writing.</Translate>
                </p>
                <CodeBlock language="bash">champollion sync</CodeBlock>
              </div>
            </li>
          </ol>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.translate.methods" description="/translate methods heading">Ten methods, mixed per pair</Translate>
          </Heading>
          <p className={styles.sectionBody}>
            <Translate id="page.translate.methodsBody" description="/translate methods body">Google Translate for French, an LLM for Japanese, a coached FST-gated plugin for a morphologically rich low-resource language — all in the same config. Every translation method is a config option, and each source→target pair picks its own.</Translate>
          </p>
          <div className={styles.linkGrid}>
            <Link to="/docs/guides/translation-methods" className={styles.linkCard}>
              <div className={styles.linkCardTitle}><Translate id="page.translate.cardMethods" description="link card">Translation methods</Translate></div>
              <p className={styles.linkCardDesc}>
                <Translate id="page.translate.cardMethodsDesc" description="link card desc">The full method matrix — LLM providers, traditional MT, plugins.</Translate>
              </p>
            </Link>
            <Link to="/docs/getting-started/quick-start" className={styles.linkCard}>
              <div className={styles.linkCardTitle}><Translate id="page.translate.cardQuick" description="link card">Quick start</Translate></div>
              <p className={styles.linkCardDesc}>
                <Translate id="page.translate.cardQuickDesc" description="link card desc">Locale file to translated app in 60 seconds, step by step.</Translate>
              </p>
            </Link>
            <Link to="/docs/reference/cli" className={styles.linkCard}>
              <div className={styles.linkCardTitle}><Translate id="page.translate.cardCli" description="link card">CLI reference</Translate></div>
              <p className={styles.linkCardDesc}>
                <Translate id="page.translate.cardCliDesc" description="link card desc">Every command and flag — sync, init, audit, doctor, and more.</Translate>
              </p>
            </Link>
            <Link to="/docs/tutorials/translate-30-languages" className={styles.linkCard}>
              <div className={styles.linkCardTitle}><Translate id="page.translate.card30" description="link card">Translate 30 languages</Translate></div>
              <p className={styles.linkCardDesc}>
                <Translate id="page.translate.card30Desc" description="link card desc">A real-world walkthrough for a production-sized locale set.</Translate>
              </p>
            </Link>
          </div>
        </section>
      </main>
    </Layout>
  );
}
