import React, {useEffect, useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import Translate, {translate} from '@docusaurus/Translate';
import {loadJoin, languageLabel} from '../utils/joinProjects.mjs';
import {SUPABASE_URL, SUPABASE_ANON_KEY} from '../utils/supabasePublic.mjs';
import {loadLanguageNameMap} from '../utils/languageLoader';
import h from '../components/home/home.module.css';

/* /join — "Join a project". The founder's decisions (2026-10-12): a project is
   a language pair with its task (what it is for, and optionally a domain and
   register) and an owner; a short review comes before it is listed; anything a
   helper offers is held by both — submitted by the helper, authorized by the
   owner. It launches with the rails. Data contract: utils/joinProjects.mjs.

   Three honest states, never a mock list: the listed projects; "No projects
   are listed yet."; and, when the read fails (until migration 079 is live the
   table does not exist), "Join a project opens with the next release." Offers
   are private and are never read here. No counts of languages, no community
   named by us — an owner's name is shown only as the owner chose it. The
   commands to offer or register live on the rails trunk; they are shown here
   once that release is in this tree (the doc-command gate checks them). */

const KIND = {
  sentences: () => translate({id: 'join.v8.kind.sentences', message: 'Sentences'}),
  'word-list': () => translate({id: 'join.v8.kind.wordList', message: 'A word list'}),
  method: () => translate({id: 'join.v8.kind.method', message: 'A method'}),
};

function ProjectCard({p, nameMap}) {
  const pair = `${languageLabel(p.source_code, p.source_name, nameMap)} → ${languageLabel(p.target_code, p.target_name, nameMap)}`;
  return (
    <article className={`${h.glass} ${h.card} ${h.joinCard}`}>
      <span className={h.num}>{pair}</span>
      <h3 className={h.cardTitle}>{p.display_name}</h3>
      {p.owner_display && (
        <p className={h.joinMeta}>
          <Translate id="join.v8.owner" values={{owner: p.owner_display}}>{'Run by {owner}'}</Translate>
        </p>
      )}
      <p>
        <Translate id="join.v8.purpose" description="{purpose} is what the project's model is for, in the owner's words" values={{purpose: p.purpose}}>{'For: {purpose}'}</Translate>
      </p>
      {(p.domain || p.register) && (
        <p className={h.joinMeta}>
          {p.domain && <Translate id="join.v8.domain" values={{domain: p.domain}}>{'Domain: {domain}'}</Translate>}
          {p.domain && p.register && ' · '}
          {p.register && <Translate id="join.v8.register" values={{register: p.register}}>{'Register: {register}'}</Translate>}
        </p>
      )}
      {p.about && <p>{p.about}</p>}
      {p.asks.length > 0 && (
        <div className={h.joinAsks}>
          <h4 className={h.joinAsksTitle}>{translate({id: 'join.v8.asksFor', message: 'Asks for'})}</h4>
          <ul>
            {p.asks.map((a) => (
              <li key={a.id}>
                <strong>{KIND[a.kind]()}</strong>
                {a.what ? ` — ${a.what}` : ''}
                {a.how_many != null && (
                  <span className={h.joinMeta}>
                    {' · '}<Translate id="join.v8.howMany" values={{n: String(a.how_many)}}>{'{n} wanted'}</Translate>
                  </span>
                )}
                {a.terms && (
                  <span className={h.joinMeta}>
                    {' · '}<Translate id="join.v8.terms" values={{terms: a.terms}}>{'Terms: {terms}'}</Translate>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function Projects() {
  const [view, setView] = useState({state: 'loading', projects: [], asksUnavailable: false});
  const [nameMap, setNameMap] = useState(null);
  useEffect(() => {
    let alive = true;
    loadJoin({base: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY}).then((r) => { if (alive) setView(r); });
    loadLanguageNameMap().then((m) => { if (alive) setNameMap(m); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (view.state === 'loading') {
    return <p className={h.caption} role="status">{translate({id: 'join.v8.loading', message: 'Looking for listed projects…'})}</p>;
  }
  if (view.state === 'closed') {
    return <p className={h.joinState}>{translate({id: 'join.v8.closed', message: 'Join a project opens with the next release.'})}</p>;
  }
  if (view.state === 'empty') {
    return <p className={h.joinState}>{translate({id: 'join.v8.empty', message: 'No projects are listed yet.'})}</p>;
  }
  return (
    <>
      {view.asksUnavailable && (
        <p className={h.caption}>{translate({id: 'join.v8.asksUnavailable', message: 'What these projects ask for could not be read just now.'})}</p>
      )}
      <div className={h.three}>
        {view.projects.map((p) => <ProjectCard key={p.id} p={p} nameMap={nameMap} />)}
      </div>
    </>
  );
}

export default function Join() {
  return (
    <Layout
      title={translate({id: 'join.v7.seo.title', message: 'Join a project'})}
      description={translate({id: 'join.v8.seo.description', message: 'Help a machine-translation project someone is already running — with sentences, a word list or a method. What you offer is held by you and the project’s owner.'})}>
      <main className={h.page}>
        <div className={h.field} aria-hidden="true" />
        <section className={h.hero}>
          <div className={h.wrap}>
            <h1 className={h.h1}>{translate({id: 'join.v7.h1', message: 'Join a project'})}</h1>
            <p className={h.sub}>
              {translate({id: 'join.v8.sub', message: 'Help a project someone is already running — with sentences, a word list, or a method.'})}
            </p>
            <p className={h.joinNote}>
              {translate({id: 'join.v8.held', message: 'What you offer is held by you both: you submit it, and the project’s owner decides whether it is used. Each project is reviewed briefly before it is listed.'})}
            </p>
          </div>
        </section>
        <section className={h.joinList}>
          <div className={h.wrap}>
            <noscript><p className={h.joinState}>{translate({id: 'join.v8.noscript', message: 'This list needs JavaScript to load.'})}</p></noscript>
            <Projects />
          </div>
        </section>
        <section className={h.closing}>
          <div className={h.wrap}>
            <div className={h.doors}>
              <Link className={`${h.btn} ${h.btnLg} ${h.primary}`} to="/#start">
                {translate({id: 'join.v7.start', message: 'Start a project of your own'})} <span className={h.arrow} aria-hidden="true">→</span>
              </Link>
              <Link className={`${h.btn} ${h.btnLg} ${h.glassBtn}`} to="/leaderboard">
                {translate({id: 'join.v7.board', message: 'See measured methods'})}
              </Link>
            </div>
            <p>
              <Translate
                id="join.v7.talk"
                description="{talk} is a mailto link"
                values={{talk: <a href="mailto:info@champollion.dev?subject=Join%20a%20project">{translate({id: 'join.v7.talkLink', message: 'Let’s talk'})}</a>}}>
                {'Want to help a project now? {talk}.'}
              </Translate>
            </p>
          </div>
        </section>
      </main>
    </Layout>
  );
}
