import React, { useState, useEffect } from 'react';
import Translate, {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';

import {
  loadSharedTaskEditions,
  formatPair,
} from '../utils/sharedTaskLoader';
import { loadLanguageNameMap } from '../utils/languageLoader';
import { pairLabel } from '../utils/recentRuns.mjs';

import styles from './spoke.module.css';

/* ====================================================================
   /shared-tasks — "Shared tasks & contests": the Network's participation
   page (founder direction 2026-07-19 — "host, contribute, challenge").

   Three ways in (host a task, contribute compute, challenge the board),
   then the live multi-pair shared-task editions. A shared task like
   AmericasNLP covers one source language → many target languages in a
   yearly cycle; each language pair runs as its own contest (own
   qualifier, own blind set, own intake window); the edition umbrella
   groups them so one edition renders as ONE page. Deep link:
   /shared-tasks?task=<shared_task_id> shows a single edition. Data is
   fetched read-only at view time (sharedTaskLoader); with nothing
   registered the page states that honestly. /contests redirects here
   (vercel.json).

   Tone contract: plain site register, for working researchers and
   speaker communities. Prizes are mentioned as possible and framed as
   structured scientific challenges (the prize spec is honest that none
   is open); the framing is shared measurement, not spectacle.
   ==================================================================== */

const statusLabel = (status) => ({
  open: translate({id: 'page.sharedTasks.statusOpen', message: 'open', description: 'contest status'}),
  closed: translate({id: 'page.sharedTasks.statusClosed', message: 'closed', description: 'contest status'}),
  archived: translate({id: 'page.sharedTasks.statusArchived', message: 'archived', description: 'contest status'}),
}[status] || status);

function ContestTable({ contests, nameMap }) {
  if (!contests.length) {
    return (
      <p className={styles.note}>
        <Translate id="page.sharedTasks.noContests" description="empty state">No per-pair contests registered for this edition yet.</Translate>
      </p>
    );
  }
  return (
    <div className={styles.miniTableWrap}>
      <table className={styles.miniTable}>
        <thead>
          <tr>
            <th><Translate id="page.sharedTasks.thPair" description="table header">Pair</Translate></th>
            <th><Translate id="page.sharedTasks.thContest" description="table header">Contest</Translate></th>
            <th><Translate id="page.sharedTasks.thStatus" description="table header">Status</Translate></th>
          </tr>
        </thead>
        <tbody>
          {contests.map((contest) => (
            <tr key={contest.id}>
              {/* Both sides NAMED (source AND target matter); codes stay
                  as the hover title and the no-map fallback. */}
              <td title={formatPair(contest.languagePair)}>
                {pairLabel(contest.languagePair, nameMap)}
              </td>
              <td>
                {contest.name}
                {contest.description ? (
                  <span className={styles.note}> — {contest.description}</span>
                ) : null}
              </td>
              <td className={styles.mono}>
                {statusLabel(contest.status)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditionSection({ edition, standalone, nameMap }) {
  return (
    <section className={styles.section}>
      <Heading as={standalone ? 'h2' : 'h2'} className={styles.sectionTitle}>
        {standalone ? (
          edition.name
        ) : (
          <Link to={`/shared-tasks?task=${encodeURIComponent(edition.sharedTaskId)}`}>
            {edition.name}
          </Link>
        )}
      </Heading>
      <p className={styles.note}>
        {edition.organizer}
        {edition.year ? <> · <Translate id="page.sharedTasks.cycle" description="edition year cycle; {year} is the year" values={{year: edition.year}}>{'{year} cycle'}</Translate></> : null}
        {edition.status === 'archived' ? <> · <Translate id="page.sharedTasks.archived" description="archived marker">archived</Translate></> : null}
        {' · '}
        {edition.contests.length}{' '}
        {edition.contests.length === 1
          ? <Translate id="page.sharedTasks.pairOne" description="singular">language pair</Translate>
          : <Translate id="page.sharedTasks.pairMany" description="plural">language pairs</Translate>}
      </p>
      {edition.description ? (
        <p className={styles.sectionBody}>{edition.description}</p>
      ) : null}
      <ContestTable contests={edition.contests} nameMap={nameMap} />
    </section>
  );
}

export default function SharedTasksPage() {
  const [editions, setEditions] = useState(null); // null = loading
  const [nameMap, setNameMap] = useState(null);
  const location = useLocation();
  const selectedId = new URLSearchParams(location.search).get('task');

  useEffect(() => {
    let cancelled = false;
    loadSharedTaskEditions().then((result) => {
      if (!cancelled) setEditions(result);
    });
    loadLanguageNameMap()
      .then((m) => { if (!cancelled && m) setNameMap(m); })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const selected =
    selectedId && editions
      ? editions.find((e) => e.sharedTaskId === selectedId)
      : null;

  return (
    <Layout
      title={selected ? selected.name : translate({id: 'page.sharedTasks.seoTitle', message: 'Shared tasks & contests', description: '/shared-tasks SEO title'})}
      description={translate({id: 'page.sharedTasks.seoDesc', message: 'Participate in the Champollion Network — host a shared task or sovereign contest, contribute compute to the open queue, or challenge the leaderboard. Multi-pair shared-task editions with qualifier-gated, organizer-scored pipelines.', description: '/shared-tasks SEO description'})}
    >
      <header className={styles.pageHeader}>
        <div className="container">
          <p className={styles.eyebrow}><Translate id="page.sharedTasks.eyebrow" description="eyebrow">THE CHAMPOLLION NETWORK</Translate></p>
          <Heading as="h1" className={styles.pageTitle}>
            {selected ? selected.name : <Translate id="page.sharedTasks.title" description="h1">Shared tasks & contests</Translate>}
          </Heading>
          <p className={styles.pageSubtitle}>
            <Translate id="page.sharedTasks.subtitle" description="page subtitle">Shared evaluation is how this field makes progress it can trust — WMT has run translation shared tasks every year since 2006, and SemEval, the CoNLL shared tasks, and AmericasNLP built common ground the same way: everyone measures on the same data, so results mean the same thing to everyone. This page is where that happens here. Done well, it helps us communicate — the point is not the competition, it's sharing one of humanity's oldest problems and solving it together.</Translate>
          </p>
        </div>
      </header>

      <main className={styles.contentWrapper}>
        {!selected && !selectedId && (
          <>
            <section className={styles.section}>
              <Heading as="h2" className={styles.sectionTitle}>
                <Translate id="page.sharedTasks.threeWays" description="section heading">Three ways in</Translate>
              </Heading>
              <div className={styles.linkGrid}>
                <Link
                  className={styles.linkCard}
                  to="/docs/network/sovereignty/run-a-sovereign-contest">
                  <div className={styles.linkCardTitle}><Translate id="page.sharedTasks.host" description="card title">Host</Translate></div>
                  <div className={styles.linkCardDesc}>
                    <Translate id="page.sharedTasks.hostDesc" description="card body">Run a shared task or a sovereign contest on your own terms. Your blind references never leave your machine — the organizer pipeline scores submissions against them and publishes only the scores. The guide walks through the per-pair setup; the edition umbrella groups your pairs into one page here.</Translate>
                  </div>
                </Link>
                <Link className={styles.linkCard} to="/contribute">
                  <div className={styles.linkCardTitle}><Translate id="page.sharedTasks.contribute" description="card title">Contribute</Translate></div>
                  <div className={styles.linkCardDesc}>
                    <Translate id="page.sharedTasks.contributeDesc" description="card body">Point compute at the open queue — one command runs the highest-value unmeasured pairs against your budget and publishes each result to the map. Corpora contributions (sentences from speakers, on community terms): coming soon.</Translate>
                  </div>
                </Link>
                <Link className={styles.linkCard} to="/leaderboard">
                  <div className={styles.linkCardTitle}><Translate id="page.sharedTasks.challenge" description="card title">Challenge</Translate></div>
                  <div className={styles.linkCardDesc}>
                    <Translate id="page.sharedTasks.challengeDesc" description="card body">Think your method translates better? Enter an open contest below, or benchmark it on the public sets and put it on the board next to everyone else's — every method is welcome, human and machine. Plugins make new methods and metrics first-class citizens.</Translate>
                  </div>
                </Link>
              </div>
            </section>

            <section className={styles.section}>
              <Heading as="h2" className={styles.sectionTitle}>
                <Translate id="page.sharedTasks.prizes" description="section heading">Prizes, when they come</Translate>
              </Heading>
              <p className={styles.sectionBody}>
                <Translate
                  id="page.sharedTasks.prizesBody"
                  description="prizes body; {spec} is a link"
                  values={{spec: <Link to="/docs/network/specifications/prizes"><Translate id="page.sharedTasks.prizeSpecLink" description="link text">prize specification</Translate></Link>}}>
                  {'Contests here can carry prizes, structured the way scientific challenge prizes are: a published spec, fixed criteria, blind evaluation, results anyone can verify. The {spec} defines how one would run — and is explicit that no prize is open yet. What is open, today, is the measurement: the queue, the board, and the shared tasks below.'}
                </Translate>
              </p>
            </section>

            <section className={styles.section}>
              <Heading as="h2" className={styles.sectionTitle}>
                <Translate id="page.sharedTasks.editions" description="section heading">Editions</Translate>
              </Heading>
              <p className={styles.sectionBody}>
                <Translate id="page.sharedTasks.editionsBody" description="editions body">A shared task covers one source language and many target languages in a yearly cycle — AmericasNLP-style. Every language pair runs as its own contest with its own public qualifier and blind test set; the edition groups them here so participants see one task, not a scatter of contests.</Translate>
              </p>
            </section>
          </>
        )}

        {editions === null ? (
          <section className={styles.section}>
            <p className={styles.sectionBody}><Translate id="page.sharedTasks.loading" description="loading state">Loading shared-task editions…</Translate></p>
          </section>
        ) : selected ? (
          <>
            <section className={styles.section}>
              <Link to="/shared-tasks"><Translate id="page.sharedTasks.backAll" description="back link">← All shared tasks</Translate></Link>
            </section>
            <EditionSection edition={selected} standalone nameMap={nameMap} />
          </>
        ) : selectedId ? (
          <section className={styles.section}>
            <p className={styles.sectionBody}>
              <Translate id="page.sharedTasks.notFound" description="unknown edition; {id} is a code span" values={{id: <code>{selectedId}</code>}}>{'No shared-task edition named {id} is registered.'}</Translate>
            </p>
            <Link to="/shared-tasks"><Translate id="page.sharedTasks.backAll2" description="back link">← All shared tasks</Translate></Link>
          </section>
        ) : editions.length === 0 ? (
          <section className={styles.section}>
            <p className={styles.sectionBody}>
              <Translate id="page.sharedTasks.empty" description="empty state">No shared-task editions are registered yet. When an organizer registers an edition and attaches its per-pair contests, it appears here as one page.</Translate>
            </p>
          </section>
        ) : (
          editions.map((edition) => (
            <EditionSection key={edition.sharedTaskId} edition={edition} nameMap={nameMap} />
          ))
        )}

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>
            <Translate id="page.sharedTasks.runOne" description="section heading">Run one</Translate>
          </Heading>
          <p className={styles.sectionBody}>
            <Translate
              id="page.sharedTasks.runOneBody"
              description="run-one body; {guide} is a link"
              values={{guide: <Link to="/docs/network/sovereignty/run-a-sovereign-contest"><Translate id="page.sharedTasks.guideLink" description="link text">run-a-sovereign-contest guide</Translate></Link>}}>
              {'Organizing a multi-pair shared task? Each pair keeps its own qualifier-gated, organizer-scored pipeline — your test references never leave your machine. The {guide} walks through the per-pair setup; the edition umbrella groups the pairs into the single page you see here.'}
            </Translate>
          </p>
        </section>
      </main>
    </Layout>
  );
}
