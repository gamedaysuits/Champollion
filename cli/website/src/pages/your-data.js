import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import {translate} from '@docusaurus/Translate';
import Register, {Caveat, Cmd, PreRelease} from '../components/rails/Register';
import {LetsTalk} from '../components/rails/sections';
import {C} from '../components/rails/commands.mjs';
import site from '../data/rails-demo/site-data.json';
import s from '../components/rails/rails.module.css';
import d from '../components/rails/YourData.module.css';

/* ====================================================================
   /your-data — where a project's data goes, and who decides.
   The data-flow picture health authorities and schools asked for:
   your computer · the guard (the people's decisions) · outside — and the
   AI agent is drawn OUTSIDE when it runs on a company's servers. Every row
   below is something the tools do today; the page says where the tools
   cannot help (an agent that opens files itself).
   ==================================================================== */


/* The picture answers ONE question: what crosses from your computer to the
   outside, and who decides. One lane per crossing, read left to right — what
   goes, a straight arrow over the line, where it goes — and each lane's tag
   says in words whether sentences go with it. What never crosses sits on top,
   as the default. HTML, not SVG: the labels wrap in every locale and on a
   phone. Teal (--guard) marks only the lane the holders decide; the gap the
   tools cannot close is dashed and says so. */
const t = (id, message) => translate({id: `rails.data.flow.${id}`, message});

function Arrow({kind}) {
  return (
    <span className={`${d.arrow} ${d[`arrow_${kind}`]}`} aria-hidden="true">
      <span className={d.shaft} />
      {kind === 'stop'
        ? <span className={d.stopBar} />
        : <svg className={d.tip} viewBox="0 0 10 10"><path d="M0 0 L10 5 L0 10 z" /></svg>}
    </span>
  );
}

function FlowDiagram() {
  const lanes = [
    {kind: 'guard', dir: 'out',
      what: t('text.what', 'Sentences whose holders let them leave'),
      tag: t('text.tag', 'only with the holders’ yes'),
      where: t('text.where', 'A model service you choose'),
      when: t('text.when', 'Only in a step that says so.')},
    {kind: 'plain', dir: 'out',
      what: t('agent.what', 'Counts, column shapes, file and tier names, scores, your answers'),
      tag: t('agent.tag', 'no sentences'),
      where: t('agent.where', 'Your AI agent’s company'),
      when: t('agent.when', 'At every step, if the agent runs on its servers.'),
      span: 2, also: t('gap.when', 'For protected text, use an agent whose model runs on this computer.')},
    {kind: 'gap', dir: 'out',
      what: t('gap.what', 'Any file your agent opens itself'),
      tag: t('gap.tag', 'the tools cannot stop this'),
      where: t('agent.where', 'Your AI agent’s company'), shared: true},
    {kind: 'plain', dir: 'out',
      what: t('net.what', 'A description of your test set'),
      tag: t('net.tag', 'no sentences'),
      where: t('net.where', 'Champollion’s network'),
      when: t('net.when', 'Only if you register it or publish a score on it.')},
    {kind: 'in', dir: 'in',
      what: t('in.what', 'The tools, a model to start from, a language’s card'),
      tag: t('in.tag', 'coming in'),
      where: t('in.where', 'Public download sites'),
      when: t('in.when', 'Looking up a card sends only the language’s code.')},
  ];
  return (
    <figure className={d.figure} aria-labelledby="flow-title">
      <p id="flow-title" className={d.flowQ}>{t('question', 'What crosses from your computer to the outside — and who decides')}</p>
      <div className={d.flow}>
        <div className={d.colHead}>{t('home', 'On your computer')}</div>
        <div className={`${d.colHead} ${d.colHeadLine}`}>{t('line', 'the holders decide')}</div>
        <div className={`${d.colHead} ${d.colHeadOut}`}>{t('out', 'Outside')}</div>

        <div className={d.stays}>
          <p className={d.staysTitle}>{t('stays', 'Stays here')}</p>
          <ul className={d.staysList}>
            <li>{t('stays.files', 'Sentences in local-only files — every file starts local-only')}</li>
            <li>{t('stays.test', 'Your test set — never trained on')}</li>
            <li>{t('stays.model', 'Your model, and what it writes until the holders agree')}</li>
          </ul>
        </div>
        <div className={d.crossStop}><Arrow kind="stop" /><span className={`${d.tag} ${d.tag_stop}`}>{t('stays.tag', 'never crosses')}</span></div>
        <div aria-hidden="true" />

        {lanes.map((l) => (
          <React.Fragment key={l.what}>
            <div className={`${d.what} ${d[`what_${l.kind}`]}`}>
              <span className={d.srOnly}>{l.dir === 'in' ? t('sr.in', 'Arrives:') : t('sr.out', 'Leaves:')} </span>
              {l.what}
            </div>
            <div className={d.cross}>
              <Arrow kind={l.kind} />
              <span className={`${d.tag} ${d[`tag_${l.kind}`]}`}>{l.tag}</span>
            </div>
            {l.shared ? (
              /* one destination, two arrows: the cell above spans both lanes;
                 a single-column phone layout names it again here */
              <div className={`${d.where} ${d.whereRepeat}`}>
                <span className={d.srOnly}>{t('sr.to', 'To:')} </span>
                <span className={d.whereName}>{l.where}</span>
              </div>
            ) : (
              <div className={d.where} style={l.span ? {gridRow: `span ${l.span}`} : undefined}>
                <span className={d.srOnly}>{l.dir === 'in' ? t('sr.from', 'From:') : t('sr.to', 'To:')} </span>
                <span className={d.whereName}>{l.where}</span>
                <span className={d.whereWhen}>{l.when}</span>
                {l.also && <span className={`${d.whereWhen} ${d.whereAlso}`}>{l.also}</span>}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      <figcaption className={d.caption}>{translate({id: 'rails.data.svg.caption', message: 'A diagram of what the tools do, not a promise about any one agent or service.'})}</figcaption>
    </figure>
  );
}

export default function YourDataPage() {
  const rows = [
    {what: translate({id: 'rails.data.r1.what', message: 'Sentences in a file marked local-only'}), to: translate({id: 'rails.data.r1.to', message: 'Nowhere. Only a model on this computer may see them.'}), when: translate({id: 'rails.data.r1.when', message: 'Never to a model service — the tools refuse. Two things they take on your word: a method you vouch for as local (--attest-local-transport), and whatever answers at this computer’s own address.'}), who: translate({id: 'rails.data.r1.who', message: 'Its holders. Every file the tools bring in starts local-only; their first answer decides, and after that no command can loosen it — only a hand edit, theirs to make. The tools record the answer they are given; they cannot tell who gave it.'})},
    {what: translate({id: 'rails.data.r2.what', message: 'Sentences whose holders let them leave'}), to: translate({id: 'rails.data.r2.to', message: 'A model service you choose — for example, to translate with it, or to measure it.'}), when: translate({id: 'rails.data.r2.when', message: 'Only in a step that says so.'}), who: translate({id: 'rails.data.r2.who', message: 'Its holders, by marking the file; you, by running that step.'})},
    {what: translate({id: 'rails.data.r3.what', message: 'What the tools tell your agent'}), to: translate({id: 'rails.data.r3.to', message: 'The agent’s company, if the agent runs on its servers.'}), when: translate({id: 'rails.data.r3.when', message: 'At every step: counts, how the columns look, the names of files, sheets and ELAN tiers (a tier is often a speaker’s name), scores, and the answers you give. Never a sentence from a local-only file, by design — but once its holders let a file leave, trying a model trained on it can show its translations.'}), who: translate({id: 'rails.data.r3.who', message: 'You, by choosing the agent.'})},
    {what: translate({id: 'rails.data.r4.what', message: 'A file your agent opens itself — or your model’s address it calls itself'}), to: translate({id: 'rails.data.r4.to', message: 'The agent’s company, if the agent runs on its servers.'}), when: translate({id: 'rails.data.r4.when', message: 'Whenever the agent reads it. The tools cannot stop this.'}), who: translate({id: 'rails.data.r4.who', message: 'You — for protected text, use an agent whose model runs on your computer. An assistant app installed on your computer usually still sends what it reads to its company.'})},
    {what: translate({id: 'rails.data.r5.what', message: 'What a model trained on local-only sentences writes'}), to: translate({id: 'rails.data.r5.to', message: 'It is treated as local-only: the rails will not connect it to a published app or site, or serve it to other machines.'}), when: translate({id: 'rails.data.r5.when', message: 'Until its holders agree — and who agreed is recorded. Until then, mt-eval translate writes its translations only inside the project.'}), who: translate({id: 'rails.data.r5.who', message: 'The holders of the sentences it learned from.'})},
    {what: translate({id: 'rails.data.r6.what', message: 'A description of your test set'}), to: translate({id: 'rails.data.r6.to', message: 'Champollion’s network.'}), when: translate({id: 'rails.data.r6.when', message: 'Only if you register it, or publish a score on it (its id, language pair, size, checksum, licence and section names go with the score). The text itself is never uploaded.'}), who: translate({id: 'rails.data.r6.who', message: 'Its holders.'})},
    {what: translate({id: 'rails.data.r7.what', message: 'The code of a language you look up'}), to: translate({id: 'rails.data.r7.to', message: 'Champollion’s public index, to fetch that language’s card.'}), when: translate({id: 'rails.data.r7.when', message: 'When the installed tool does not have the card — and once a day, on any command, a check for updated cards that sends no code. The host sees your computer’s internet address, as any website does.'}), who: translate({id: 'rails.data.r7.who', message: 'You — the setting below stops these lookups.'})},
  ];
  return (
    <Layout
      title={translate({id: 'rails.data.seo.title', message: 'Where your data goes'})}
      description={translate({id: 'rails.data.seo.description', message: 'Where a Champollion project’s data can go, when, and who decides — including what an outside AI agent sees.'})}>
      <main className={s.page}>
        <header className={d.head}>
          <div className={s.wrap}>
            <PreRelease />
            <p className={d.kicker}>{translate({id: 'rails.data.kicker', message: 'Your data'})}</p>
            <h1 className={d.h1}>{translate({id: 'rails.data.h1', message: 'Where your data goes.'})}</h1>
            <p className={s.lede}>{translate({id: 'rails.data.lede', message: 'For everything that could leave your computer: where it goes, when, and who decides. The short answer: your sentences stay where they are unless the people who hold them decide otherwise — with gaps the tools cannot close for you, said below: an AI agent can open your files itself, and the tools cannot tell who answered their questions.'})}</p>
          </div>
        </header>

        <Register n="01" kicker={translate({id: 'rails.data.s1', message: 'The picture'})} id="picture">
          <FlowDiagram />
        </Register>

        <Register n="02" kicker={translate({id: 'rails.data.s2', message: 'Line by line'})} id="table"
          title={translate({id: 'rails.data.s2.title', message: 'What could leave, when, and who decides.'})}>
          <div className={d.tableWrap}>
            <table className={d.table}>
              <thead>
                <tr>
                  <th scope="col">{translate({id: 'rails.data.th.what', message: 'What'})}</th>
                  <th scope="col">{translate({id: 'rails.data.th.to', message: 'Where it can go'})}</th>
                  <th scope="col">{translate({id: 'rails.data.th.when', message: 'When'})}</th>
                  <th scope="col">{translate({id: 'rails.data.th.who', message: 'Who decides'})}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.what}><th scope="row">{r.what}</th><td>{r.to}</td><td>{r.when}</td><td>{r.who}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.body}>{translate({id: 'rails.data.mark', message: 'The record beside a file is written with one command, and no command ever loosens it:'})} <Cmd>{C.mark.cmd}</Cmd></p>
          <p className={s.body}>{translate({id: 'rails.data.offline', message: 'To stop the tools’ own lookups, set this in your shell and in your agent’s MCP server settings:'})} <Cmd>{C.offline.cmd}</Cmd></p>
        </Register>

        <Register n="03" kicker={translate({id: 'rails.data.s3', message: 'The gap'})} id="agent"
          title={translate({id: 'rails.data.s3.title', message: 'About your AI agent.'})}>
          <Caveat label={translate({id: 'rails.data.s3.label', message: 'What the tools cannot do for you'})}>
            <p className={d.p}>{translate({id: 'rails.data.s3.p1', message: 'The rails tools are built to tell an agent about your files without showing it your sentences: how many pairs, how the columns look, which file holds what. That keeps your text out of the conversation an agent sends to its company.'})}</p>
            <p className={d.p}>{translate({id: 'rails.data.s3.p3', message: 'Two more things the tools cannot check: who answered their questions (they record the answer the agent passes on), and whether a yes to training really came from you. Answer the holders’ questions yourself.'})}</p>
            <p className={d.p}>{translate({id: 'rails.data.s3.p2', message: 'But an agent with access to your computer can open a file on its own, and then what it reads goes wherever the agent’s model runs. Nothing in the tools can prevent that today. For text that must not leave, use an agent whose model runs on your own computer (an assistant app installed on your computer usually still sends what it reads to its company), keep the agent out of that folder, or run the steps yourself.'})}</p>
          </Caveat>
        </Register>

        <Register n="04" kicker={translate({id: 'rails.data.s4', message: 'Sharing with the network'})} id="network"
          title={translate({id: 'rails.data.s4.title', message: 'Only if you choose to.'})}>
          <p className={s.body}>{translate({id: 'rails.data.s4.lede', message: 'You never have to register anything. If you want results that others can compare against, a test set can be registered in one of these ways:'})}</p>
          <ul className={d.tiers}>
            {site.tiers.map((x) => (
              <li key={x.key}>
                <span className={d.tierKey} translate="no">{x.key}</span> <strong>{x.label}.</strong> {x.explanation}
                {x.key === 'sealed' && <> <span className={d.keys}>{translate({id: 'rails.data.s4.keys', message: 'Who holds the keys today: the organizer who seals the set. Community key custodians — none appointed yet. Champollion holds no key shares.'})}</span></>}
              </li>
            ))}
          </ul>
          <p className={s.body}><Link to="/docs/your-words-your-rules">{translate({id: 'rails.data.s4.more', message: 'More on sealed test sets and data sovereignty →'})}</Link></p>
        </Register>

        <LetsTalk n="05" />
      </main>
    </Layout>
  );
}
