import React, { useState, useEffect } from 'react';
import Translate, {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';

import ProvenanceTip from '../components/ProvenanceTip';
import Tip from '../components/Tip';
import { termAnchor } from '../utils/explainerLoader';
import { loadLanguageNameMap } from '../utils/languageLoader';
import { pairLabel } from '../utils/recentRuns.mjs';

import styles from './spoke.module.css';

// Inline jargon explainers for the newcomer-facing copy below — each links to
// the full glossary entry.
const chrfTip = () => ({
  term: 'chrF++',
  body: translate({id: 'page.arena.chrfTip', message: 'An automatic score that measures how much a translation’s characters overlap with a reference translation. Fairer to richly-inflected languages than word-based scores — but it only checks surface similarity, not whether the words are real.', description: '/arena chrF++ tooltip'}),
  href: `/glossary#${termAnchor('chrF')}`,
});
const fstTip = () => ({
  term: translate({id: 'page.arena.fstTerm', message: 'morphological analyzer (FST)', description: '/arena FST tooltip term'}),
  body: translate({id: 'page.arena.fstTip', message: 'A rule-based tool that knows a language’s word-building grammar, so it can check whether each output word is actually a valid, well-formed word — something surface-overlap scores can’t see.', description: '/arena FST tooltip'}),
  href: `/glossary#${termAnchor('FST')}`,
});

/* ====================================================================
   /arena — the Network landing ("Method builder" door from the homepage).
   Why the Network exists, the chrF++-rewards-hallucination contrast, a
   top-5 leaderboard embed, the harness install one-liner, and links to the
   specifications in the Network docs (champollion.dev/arena). The URL stays
   /arena (redirects preserved); every visible label says "the Network".
   All numbers sourced in cli/website/CLAIMS.md.
   ==================================================================== */

// Supabase public config — same read-only anon key as leaderboard.js
const SUPABASE_URL = 'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

// Network doc links — now same-build (the Network docs are a docs instance under
// /docs/network), so these are root-relative internal links: SPA-navigable and
// broken-link-checked at build time. Targets are the docs' real SLUGS (set by
// frontmatter `slug:`, which overrides the filename — e.g. benchmark-spec.md
// serves at /specifications/benchmark).
const specLinks = () => [
  {
    title: translate({id: 'page.arena.spec1', message: 'How it works', description: '/arena spec link'}),
    desc: translate({id: 'page.arena.spec1Desc', message: 'The full pipeline — datasets, runs, run cards, trust tiers.', description: '/arena spec link desc'}),
    href: '/docs/network/how-it-works',
  },
  {
    title: translate({id: 'page.arena.spec2', message: 'Scoring specification', description: '/arena spec link'}),
    desc: translate({id: 'page.arena.spec2Desc', message: 'Composite score, metric definitions, tier thresholds.', description: '/arena spec link desc'}),
    href: '/docs/network/specifications/scoring',
  },
  {
    title: translate({id: 'page.arena.spec3', message: 'Benchmark specification', description: '/arena spec link'}),
    desc: translate({id: 'page.arena.spec3Desc', message: 'What counts as a valid benchmark run and why.', description: '/arena spec link desc'}),
    href: '/docs/network/specifications/benchmark',
  },
  {
    title: translate({id: 'page.arena.spec4', message: 'Prize specification', description: '/arena spec link'}),
    desc: translate({id: 'page.arena.spec4Desc', message: 'How contests and verification will work.', description: '/arena spec link desc'}),
    href: '/docs/network/specifications/prizes',
  },
];

function MiniLeaderboard() {
  const [rows, setRows] = useState([]);
  const [nameMap, setNameMap] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Ordered by RECENCY (what the section title claims), not by score:
        // ranking runs from DIFFERENT language pairs by raw chrF++ is a
        // cross-language comparison the chance floor makes meaningless
        // (see /docs/network/specifications/connection-strength). Each row
        // still shows its own within-pair chrF++ value.
        const resp = await fetch(
          `${SUPABASE_URL}/rest/v1/run_cards?select=model_slug,condition,chrf_plus_plus,language_pair,total_cost_usd,submitted_at&trust=neq.disqualified&order=submitted_at.desc.nullslast&limit=5`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          },
        );
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled && Array.isArray(data)) setRows(data);
      } catch {
        /* non-fatal — section hides itself */
      }
    })();
    // Both sides NAMED (founder 2026-07-19: source AND target matter) —
    // codes remain as the hover title; degrades to codes if the map fails.
    loadLanguageNameMap()
      .then((m) => { if (!cancelled && m) setNameMap(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (rows.length === 0) return null;

  return (
    <section className={styles.section}>
      <Heading as="h2" className={styles.sectionTitle}>
        <Translate id="page.arena.recentRuns" description="/arena mini leaderboard heading">Recent runs</Translate>
      </Heading>
      <div className={styles.miniTableWrap}><table className={styles.miniTable}>
        <thead>
          <tr>
            <th>#</th>
            <th><Translate id="page.arena.thModel" description="table header">Model</Translate></th>
            <th><Translate id="page.arena.thCondition" description="table header">Condition</Translate></th>
            <th><Translate id="page.arena.thPair" description="table header">Pair</Translate></th>
            <th>chrF++</th>
            <th><Translate id="page.arena.thCost" description="table header">Cost</Translate></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td className={styles.mono}>{row.model_slug}</td>
              <td className={styles.mono}>{row.condition}</td>
<td title={(row.language_pair || '?').replace('>', ' → ')}>
                {pairLabel(row.language_pair, nameMap)}
              </td>
              <td className={styles.scoreCell}>{row.chrf_plus_plus ?? '—'}</td>
              <td>{row.total_cost_usd != null ? `$${row.total_cost_usd.toFixed(2)}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <Link to="/leaderboard" className="button button--primary button--sm">
        <Translate id="page.arena.fullLeaderboard" description="/arena leaderboard link">Full leaderboard →</Translate>
      </Link>
    </section>
  );
}

export default function ArenaPage() {
  return (
    <Layout
      title={translate({id: 'page.arena.seoTitle', message: 'How the Network works', description: '/arena SEO title'})}
      description={translate({id: 'page.arena.seoDesc', message: 'Open, reproducible machine translation infrastructure for low-resource languages. Add a method, run it on shared test sets, and get a traceable score — and the methods that work deploy to the communities they serve.', description: '/arena SEO description'})}
    >
      <header className={styles.pageHeader}>
        <div className="container">
          <p className={styles.eyebrow}><Translate id="page.arena.eyebrow" description="/arena eyebrow">THE CHAMPOLLION NETWORK</Translate></p>
          <Heading as="h1" className={styles.pageTitle}>
            <Translate id="page.arena.title" description="/arena h1">How the Network works</Translate>
          </Heading>
          <p className={styles.pageSubtitle}>
            <Translate id="page.arena.subtitle" description="/arena subtitle">The Network is an open, shared place to measure how well any method translates into the languages big tech skips. Add a method — human or machine — run it on the same test sets as everyone else, and get a score anyone can check. Nobody crowns a winner; the results speak for themselves.</Translate>
          </p>
        </div>
      </header>

      <main className={styles.contentWrapper}>
        {/* Three plain-language steps — what actually happens. */}
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.arena.threeSteps" description="section heading">Three steps</Translate>
          </Heading>
          <ol className={styles.stepsList}>
            <li>
              <Translate id="page.arena.step1" description="step; {b} is the bold lead-in" values={{b: <strong><Translate id="page.arena.step1Lead" description="bold lead">Add a method.</Translate></strong>}}>{'{b} Anything that can translate text — a prompted language model, a fine-tuned model, a rule-based system, even a human translator — can take part.'}</Translate>
            </li>
            <li>
              <Translate id="page.arena.step2" description="step; {b} is the bold lead-in" values={{b: <strong><Translate id="page.arena.step2Lead" description="bold lead">Run it on shared test sets.</Translate></strong>}}>{'{b} The same versioned, fetch-from-source corpora for everyone, so two methods can be compared fairly, pair by pair.'}</Translate>
            </li>
            <li>
              <Translate id="page.arena.step3" description="step; {b} is the bold lead-in" values={{b: <strong><Translate id="page.arena.step3Lead" description="bold lead">Get a traceable score.</Translate></strong>}}>{'{b} Every number links back to the exact corpus and settings that produced it — no scraped black boxes, nothing you can’t re-run yourself.'}</Translate>
            </li>
          </ol>
        </section>

        {/* The thesis, told for a newcomer: a fluent-looking translation can be wrong. */}
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.arena.whyHeading" description="section heading">Why we measure more than word-overlap</Translate>
          </Heading>
          <p className={styles.sectionBody}>
            <Translate
              id="page.arena.whyBody"
              description="/arena thesis paragraph; {chrf} and {fst} are jargon tooltips, {spec} a link"
              values={{
                chrf: <Tip {...chrfTip()}><span className={styles.jargon}>chrF++</span></Tip>,
                fst: <Tip {...fstTip()}><span className={styles.jargon}><Translate id="page.arena.fstJargon" description="jargon span">morphological analyzer</Translate></span></Tip>,
                spec: <Link to="/docs/network/specifications/scoring"><Translate id="page.arena.scoringSpec" description="scoring spec link">scoring spec</Translate></Link>,
              }}>
              {'A translation can look fluent and still be wrong — made of words that don’t actually exist in the target language. The most common automatic scores, like {chrf}, only check how much the output’s characters overlap with a reference; they never check whether a word is real. For richly-inflected languages that gap is decisive. So the Network also runs a {fst} and meaning-based checks — not surface overlap alone. (The full set of metrics is in the {spec}.)'}
            </Translate>
          </p>
        </section>

        <MiniLeaderboard />

        {/* Join in */}
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.arena.tryIt" description="section heading">Try it</Translate>
          </Heading>
          <p className={styles.sectionBody}>
            <Translate id="page.arena.tryBody" description="try-it body">One command installs the evaluation harness. Any kind of method can take part — a prompted language model, a fine-tune, a rule-based system, or a human translator.</Translate>
          </p>
          <div className={styles.commandRow}>
            <code className={styles.commandCode}>pipx install mt-eval-harness</code>
          </div>
          <p className={styles.note}>
            <Translate
              id="page.arena.installNote"
              description="install note; {pkg} is a code span, {guide} a link"
              values={{
                pkg: <code>mt-eval</code>,
                guide: <Link to="/docs/network/getting-started/submit-a-method"><Translate id="page.arena.guideLink" description="guide link text">submit-a-method guide</Translate></Link>,
              }}>
              {'Installs from PyPI ({pkg}) — python3 + pipx, no sudo, ever. New here? The {guide} walks through your first run.'}
            </Translate>
          </p>
        </section>

        {/* Specs */}
        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.arena.readRules" description="section heading">Read the rules</Translate>
          </Heading>
          <div className={styles.linkGrid}>
            {specLinks().map((link) => (
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
