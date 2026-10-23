import React from 'react';
import Link from '@docusaurus/Link';
import {translate} from '@docusaurus/Translate';
import recording from '../../data/rails-demo/recording.json';
import site from '../../data/rails-demo/site-data.json';
import {facts as readFacts, overlaps} from '../../utils/railsDemo.mjs';
import Register, {Caveat, Cmd} from './Register';
import {C} from './commands.mjs';
import s from './rails.module.css';
import l from './Landing.module.css';

/*
 * The landing page's sections after the hero, in the order a visitor's
 * journey takes them (plan Phase 2, S2–S8). Every number comes from the
 * recorded walk (railsDemo.facts) or from site-data.json (generated from the
 * tools by scripts/build-rails-data.mjs); every command from commands.mjs.
 */

export const F = readFacts(recording);
const fmt = (x) => x.toFixed(2);
const ci = (x) => `${fmt(x.score)} [${fmt(x.lo)}, ${fmt(x.hi)}]`;
export const CONTACT = 'mailto:info@champollion.dev?subject=Let%E2%80%99s%20talk';

/* ── S2 · Your data, your call ─────────────────────────────────────────── */
export function YourData({compact = false}) {
  const noUpload = site.tiers.every((x) => !x.uploadsContent);
  return (
    <Register n="02" kicker={translate({id: 'rails.s2.kicker', message: 'Your data'})} id="your-data-call"
      title={translate({id: 'rails.s2.title', message: 'Your data, your call.'})}>
      <p className={s.lede}>
        {translate({id: 'rails.s2.lede', message: 'Beside each data file, a small record says what the people who hold it decided. Every tool reads it and obeys it, and no tool will ever loosen it: loosening it is a hand edit, for its holders to make.'})}
      </p>
      <div className={s.grid3}>
        <div className={`${s.card} ${s.guarded}`}>
          <span className={s.guardLabel}>{translate({id: 'rails.s2.q1.label', message: 'They decide'})}</span>
          <h3>{translate({id: 'rails.s2.q1', message: 'Who holds it?'})}</h3>
          <p>{translate({id: 'rails.s2.q1.body', message: 'In their own words — a family, a teacher, a council. It is written beside the file; the files the tools make from it carry its restrictions.'})}</p>
        </div>
        <div className={`${s.card} ${s.guarded}`}>
          <span className={s.guardLabel}>{translate({id: 'rails.s2.q2.label', message: 'They decide'})}</span>
          <h3>{translate({id: 'rails.s2.q2', message: 'May a model learn from it?'})}</h3>
          <p>{translate({id: 'rails.s2.q2.body', message: 'If they say no, no tool may train a model on that file. A test set is never trained on.'})}</p>
        </div>
        <div className={`${s.card} ${s.guarded}`}>
          <span className={s.guardLabel}>{translate({id: 'rails.s2.q3.label', message: 'They decide'})}</span>
          <h3>{translate({id: 'rails.s2.q3', message: 'May its text leave this computer?'})}</h3>
          <p>{translate({id: 'rails.s2.q3.body', message: 'Every file the tools bring in starts “local-only”: only a model on this computer may see its text, and the tools refuse to send it to any model service — until its holders say otherwise. (A file you put in place yourself has no record until you mark it.)'})}</p>
        </div>
      </div>
      <p className={l.cmdLine}><Cmd>{C.mark.cmd}</Cmd></p>

      <div className={l.agentNote}>
        <Caveat label={translate({id: 'rails.s2.agent.label', message: 'Your AI agent is an outside service too'})}>
          {translate({id: 'rails.s2.agent.body', message: 'If your agent’s model runs on a company’s servers — as most assistant apps’ do, even when the app is installed on your computer — what the tools tell it goes there: counts, how the columns look, the names of files, sheets and ELAN tiers (a tier is often a speaker’s name), scores, and the answers you give. The tools are built never to hand it a sentence from a local-only file. They cannot stop an agent that opens your files itself — so for protected text, use an agent whose model runs on your own computer, or keep the agent out of those files.'})}
        </Caveat>
      </div>

      {!compact && (
        <>
          <h3 className={l.subhead}>{translate({id: 'rails.s2.network', message: 'If you choose to share with the network'})}</h3>
          <p className={s.body}>
            {noUpload
              ? translate({id: 'rails.s2.network.lede', message: 'A test set can be registered with the network in four ways. None of them uploads your text.'})
              : translate({id: 'rails.s2.network.ledeAlt', message: 'A test set can be registered with the network in these ways.'})}
          </p>
          <ul className={l.tiers}>
            {site.tiers.map((x) => (
              <li key={x.key} className={x.default ? l.tierDefault : l.tier}>
                <span className={l.tierKey} translate="no">{x.key}{x.default ? ` · ${translate({id: 'rails.s2.default', message: 'the default'})}` : ''}</span>
                <strong>{x.label}</strong>
                <span>{x.explanation}</span>
                {x.key === 'sealed' && (
                  <span className={l.tierKeys}>
                    {translate({id: 'rails.s2.sealedKeys', message: 'Who holds the keys today: the organizer who seals the set. Community key custodians — none appointed yet.'})}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <p><Link className={s.secondary} to="/your-data">{translate({id: 'rails.s2.cta', message: 'See where your data goes, step by step'})}</Link></p>
    </Register>
  );
}

/* ── S3 · A place for everything ───────────────────────────────────────── */
const FOLDER_CMD = {
  'inbox/': C.addPairs.cmd,
  'data/parallel/': C.combine.cmd,
  'data/test/': C.addTest.cmd,
  'data/lexicon/': C.addLexicon.cmd,
};
export function PlaceForEverything() {
  return (
    <Register n="03" kicker={translate({id: 'rails.s3.kicker', message: 'A place for everything'})} id="anatomy"
      title={translate({id: 'rails.s3.title', message: 'A place for everything.'})}>
      <p className={s.lede}>
        {translate({id: 'rails.s3.lede', message: 'Every project gets the same folders, and a README that says what goes where. Your agent puts things in their place; you can always open the folder and see.'})}
      </p>
      <p className={l.cmdLine}><Cmd>{C.newGeneric.cmd}</Cmd></p>
      <p className={s.body}>{translate({id: 'rails.s3.qaa', message: 'A language with no code yet gets a private one — the walk above used'})} <Cmd>{C.newFamily.cmd}</Cmd></p>
      <div className={l.anatomy} role="table" aria-label={translate({id: 'rails.s3.table', message: 'The folders of a project'})}>
        {site.anatomy.rows.map((r) => (
          <div key={r.folder} className={l.anatomyRow} role="row">
            <span className={l.folder} role="cell" dir="ltr" translate="no">{r.folder}</span>
            <span className={l.holds} role="cell">{r.holds}</span>
            <span className={l.rowCmd} role="cell">{FOLDER_CMD[r.folder] ? <Cmd>{FOLDER_CMD[r.folder]}</Cmd> : null}</span>
          </div>
        ))}
        <div className={l.anatomyRow} role="row">
          <span className={l.folder} role="cell" dir="ltr" translate="no">gates/</span>
          <span className={l.holds} role="cell">{translate({id: 'rails.s3.gates', message: 'Your own checks on each translation — for example a minimum score on a metric — applied when you translate or serve through a deployment file. Yours to write; nothing is checked unless you add a check.'})}</span>
          <span className={l.rowCmd} role="cell"><Cmd>{C.translate.cmd}</Cmd></span>
        </div>
        <div className={l.anatomyRow} role="row">
          <span className={l.folder} role="cell" dir="ltr" translate="no">deploy/</span>
          <span className={l.holds} role="cell">{translate({id: 'rails.s3.deploy', message: 'What you serve: the method, the model, your checks and the language pair, in one file — one file that mt-eval can both test and serve.'})}</span>
          <span className={l.rowCmd} role="cell"><Cmd>{C.serve.cmd}</Cmd></span>
        </div>
      </div>
      <div className={`${s.body} ${s.guarded} ${l.sidecar}`}>
        <span className={s.guardLabel}>{translate({id: 'rails.s3.sidecarLabel', message: 'beside every data file'})}</span>
        <p>{site.anatomy.sidecar}</p>
      </div>
      <p className={s.body}>
        {translate({id: 'rails.s3.next', message: 'At any point, one command reads the project’s files and says the one next step:'})} <Cmd>{C.next.cmd}</Cmd>
      </p>
    </Register>
  );
}

/* ── S4 · Built so you can't fool yourself ─────────────────────────────── */
function Interval({x, label, kind}) {
  // 0–100 axis: chrF++'s own range.
  return (
    <div className={l.ivRow}>
      <span className={l.ivLabel}>{label}</span>
      <span className={l.ivTrack} aria-hidden="true">
        <span className={kind === 'double' ? l.ivBarDouble : l.ivBar} style={{insetInlineStart: `${x.lo}%`, width: `${Math.max(x.hi - x.lo, 0.6)}%`}} />
        <span className={kind === 'double' ? l.ivDotDouble : l.ivDot} style={{insetInlineStart: `${x.score}%`}} />
      </span>
      <span className={l.ivValue} translate="no" dir="ltr">chrF++ {ci(x)}</span>
    </div>
  );
}

export function CantFoolYourself() {
  const strict = F.twins.of - F.twins.n;
  const rows = [
    {k: translate({id: 'rails.s4.r1.k', message: 'Screen'}), v: <>{F.twins.n} {translate({id: 'rails.s4.of', message: 'of'})} {F.twins.of} {translate({id: 'rails.s4.r1.v', message: 'test sentences'})} ({F.twins.pct}%) {translate({id: 'rails.s4.r1.v2b', message: 'nearly repeat a training sentence. The training tool reports the score on the other'})} {strict} {translate({id: 'rails.s4.r1.v3b', message: 'beside the full score, so you can see how much the copies flatter it.'})}</>},
    {k: translate({id: 'rails.s4.r2.k', message: 'Predict'}), v: <>{translate({id: 'rails.s4.r2.v', message: 'Written down before any score existed:'})} <q translate="no">{F.prediction.expect}</q> — <q translate="no">{F.prediction.why}</q>.</>},
    {k: translate({id: 'rails.s4.r3.k', message: 'Floor', description: 'Row label: the baseline score a model must beat (what simply looking words up in a word list scores) — a minimum, like a price floor; never a floor of a building'}), v: <>{translate({id: 'rails.s4.r3.v', message: 'Looking each word up in the family’s word list:'})} <span translate="no" dir="ltr">chrF++ {ci(F.floor)}</span> {translate({id: 'rails.s4.r3.v2', message: 'on the dev sentences. A model is worth using only where it beats that.'})}</>},
    {k: translate({id: 'rails.s4.r4.k', message: 'Measure'}), v: <>{translate({id: 'rails.s4.r4.v', message: 'The model:'})} <span translate="no" dir="ltr">dev chrF++ {ci(F.devModel)}</span>. {translate({id: 'rails.s4.r4.v2', message: 'The tools said it plainly: not shown to do better than looking words up.'})}</>},
    {k: translate({id: 'rails.s4.r5.k', message: 'Judge'}), v: <>{translate({id: 'rails.s4.r5.v', message: 'The prediction, judged by the people who made it:'})} <strong translate="no">{F.verdict.verdict}</strong> — {F.verdict.by}.</>},
  ];
  return (
    <Register n="04" kicker={translate({id: 'rails.s4.kicker', message: 'No fooling yourself'})} id="honest"
      title={translate({id: 'rails.s4.title', message: 'Built so you can’t fool yourself.'})}>
      <p className={s.lede}>
        {translate({id: 'rails.s4.lede', message: 'The rails put the checks where people usually skip them. This is what they reported in the recorded walk above.'})}
      </p>
      <ol className={l.ledger}>
        {rows.map((r, i) => (
          <li key={i}><span className={l.ledgerK}>{r.k}</span><span className={l.ledgerV}>{r.v}</span></li>
        ))}
      </ol>
      <figure className={l.ivFigure} aria-label={translate({id: 'rails.s4.chart', message: 'The dictionary floor and the model, with their uncertainty, on a 0 to 100 scale'})}>
        <Interval x={F.floor} label={translate({id: 'rails.s4.chart.floor', message: 'Word-list floor (dev)'})} />
        <Interval x={F.devModel} label={translate({id: 'rails.s4.chart.model', message: 'Model — a test double (dev)'})} kind="double" />
        <div className={l.ivAxis} aria-hidden="true" dir="ltr"><span>0</span><span>50</span><span>100</span></div>
        <figcaption className={l.ivCaption}>
          {overlaps(F.floor, F.devModel)
            ? translate({id: 'rails.s4.chart.overlap', message: 'The bars show each score’s uncertainty. They overlap, so neither is ranked above the other.'})
            : translate({id: 'rails.s4.chart.apart', message: 'The bars show each score’s uncertainty. They do not overlap: the model scored lower than looking words up.'})}
          {' '}{translate({id: 'rails.s4.small', message: 'Both are measured on'})} {F.floor.devSentences} {F.devTwins.n > 0
            ? <>{translate({id: 'rails.s4.small2', message: 'dev sentences: the tools warned that intervals from so few may be too narrow, and that'})} {F.devTwins.n} {translate({id: 'rails.s4.small3', message: 'of the'})} {F.devTwins.of} {translate({id: 'rails.s4.small4', message: 'nearly repeat a training sentence.'})}</>
            : translate({id: 'rails.s4.smallNone', message: 'dev sentences: the tools warned that intervals from so few may be too narrow. None of them nearly repeats a training sentence: the split keeps near-copies on the same side.'})}
          {' '}{translate({id: 'rails.s4.chrf', message: 'chrF++ compares a translation with a checked one, letter by letter, from 0 to 100.'})}
        </figcaption>
      </figure>
      <Caveat label={translate({id: 'rails.s4.caveat.label', message: 'What this does not show'})}>
        <p className={l.caveatP}>
          {translate({id: 'rails.s4.caveat.1', message: 'The model in this walk is a test double, so its numbers show what the tools report — not what any model can do.'})}
        </p>
        <p className={l.caveatP}>
          {translate({id: 'rails.s4.caveat.2', message: 'For a first real model trained on a laptop, the training tool itself says to expect:'})} <q translate="no">{F.expect}</q>
        </p>
        <p className={l.caveatP}>
          <strong>{translate({id: 'rails.s4.caveat.3', message: 'A small community corpus usually gives a measured phrasebook, not a translator. The rails promise you will know how good a model is — not that it is good. A fluent speaker decides what is fit to use.'})}</strong>
        </p>
      </Caveat>
    </Register>
  );
}

/* ── S5 · Three rails, same guardrails ─────────────────────────────────── */
export function ThreeRails() {
  const doors = [
    {to: '/start', label: translate({id: 'rails.s5.door.family', message: 'A speaker or a family'})},
    {to: '/docs/getting-started/who-may-use-this', label: translate({id: 'rails.s5.door.public', message: 'A school, health authority or public body'})},
    {to: '/docs/agents/shell', label: translate({id: 'rails.s5.door.ml', message: 'An ML developer'})},
    {to: '/docs/reference/leaderboard', label: translate({id: 'rails.s5.door.funder', message: 'A funder'})},
    {to: '/for-agents', label: translate({id: 'rails.s5.door.agent', message: 'An AI agent'})},
  ];
  return (
    <Register n="05" kicker={translate({id: 'rails.s5.kicker', message: 'Three rails'})} id="three-rails"
      title={translate({id: 'rails.s5.title', message: 'Three rails. Same guardrails.'})}>
      <div className={s.grid3}>
        <div className={s.card}>
          <span className={s.status}>{translate({id: 'rails.s5.build.status', message: 'Walked end to end in our tests, on invented data · no community has walked it yet'})}</span>
          <h3>{translate({id: 'rails.s5.build', message: 'Build a method for your language'})}</h3>
          <p>{translate({id: 'rails.s5.build.body', message: 'From the files you keep to a measured model on your own computer: gather, decide, keep a test set, screen, predict, train, measure, judge.'})}</p>
          <p><Link to="/start">{translate({id: 'rails.s5.build.cta', message: 'Start building →'})}</Link></p>
        </div>
        <div className={s.card}>
          <span className={`${s.status} ${s.statusOpen}`}>{translate({id: 'rails.s5.host.status', message: 'Not on the rails yet · no bounty is open'})}</span>
          <h3>{translate({id: 'rails.s5.host', message: 'Host a sealed bounty on your test set'})}</h3>
          <p>{translate({id: 'rails.s5.host.body', message: 'Methods compete on a sealed test set: scores are published; the sentences are not. Today the keys are held by whoever organizes it — community key custodians: none appointed yet. The holders’ terms decide what happens to a winning method.'})}</p>
          <p><Link to="/shared-tasks">{translate({id: 'rails.s5.host.cta', message: 'How sealed bounties work →'})}</Link></p>
        </div>
        <div className={s.card}>
          <span className={s.status}>{translate({id: 'rails.s5.serve.status', message: 'Tested with a tiny model on one computer'})}</span>
          <h3>{translate({id: 'rails.s5.serve', message: 'Serve your own translation API'})}</h3>
          <p>{translate({id: 'rails.s5.serve.body', message: 'Serve your model on your own computer as a translation API, or put it into your app or website. A model that learned from local-only sentences is treated as local-only too: the rails will not connect it to a published app or site, or serve it to other machines, until its holders agree.'})}</p>
          <p><Cmd>{C.connect.cmd}</Cmd></p>
        </div>
      </div>
      <nav className={l.doors} aria-label={translate({id: 'rails.s5.doors', message: 'Start where you are'})}>
        <span className={l.doorsLabel}>{translate({id: 'rails.s5.doors', message: 'Start where you are'})}</span>
        {doors.map((d) => <Link key={d.to} to={d.to} className={l.door}>{d.label}</Link>)}
      </nav>
    </Register>
  );
}

/* ── S6 · Let's talk ───────────────────────────────────────────────────── */
export function LetsTalk({n = '06'}) {
  return (
    <Register n={n} kicker={translate({id: 'rails.s6.kicker', message: 'Help'})} id="lets-talk"
      title={translate({id: 'rails.s6.title', message: 'Having trouble, or want help? Let’s talk.'})}>
      <div className={s.body}>
        <p>{translate({id: 'rails.s6.p1', message: 'We can help you set up, structure your data, train, and teach — or run the infrastructure, if your community asks us to. There is no price list: what help looks like is worked out with each community.'})}</p>
        <p>{translate({id: 'rails.s6.p2', message: 'You never need us. There is no account and no sign-up; the tools run on your own computer. Champollion takes no share of anything a community earns.'})}</p>
      </div>
      <p><a className={s.primary} href={CONTACT}>{translate({id: 'rails.s6.cta', message: 'Let’s talk'})} <span aria-hidden="true">→</span></a></p>
    </Register>
  );
}

/* ── S7 · Why "Champollion"? ───────────────────────────────────────────── */
export function TheName() {
  return (
    <Register n="07" kicker={translate({id: 'rails.s7.kicker', message: 'The name'})} id="the-name"
      title={translate({id: 'rails.s7.title', message: 'Why “Champollion”?'})}>
      <div className={s.body}>
        <p>{translate({id: 'rails.s7.p1', message: 'Jean-François Champollion read Egyptian hieroglyphs through Coptic, the last stage of the Egyptian language, kept alive in the liturgy of the Coptic Church. The Greek on the Rosetta Stone gave him names; the living tradition gave him the language.'})}</p>
        <p>{translate({id: 'rails.s7.p2', message: 'We keep the method, not the man: the people who carry a language are the way in, and the work goes through them. We are a non-Indigenous project: any work we do for a community is in a service capacity, and only with its consent.'})}</p>
      </div>
      <p><Link to="/docs/the-name">{translate({id: 'rails.s7.cta', message: 'On the name — including the colonial history that comes with it →'})}</Link></p>
    </Register>
  );
}

/* ── S8 · The long vision (a static poster, no graph code on this page) ─ */
export function LongVision() {
  const lines = Array.from({length: 9}, (_, i) => i);
  return (
    <Register n="08" kicker={translate({id: 'rails.s8.kicker', message: 'The long vision'})} id="vision"
      title={translate({id: 'rails.s8.title', message: 'The long vision.'})}>
      <div className={l.vision}>
        <svg className={l.poster} viewBox="0 0 480 220" role="img" aria-labelledby="vision-poster-title">
          <title id="vision-poster-title">{translate({id: 'rails.s8.poster', message: 'Illustration: pairs of parallel lines joining into a network'})}</title>
          {lines.map((i) => {
            const y = 24 + i * 21;
            const tx = 300 + ((i * 37) % 120);
            const ty = 40 + ((i * 53) % 140);
            return (
              <g key={i}>
                <path d={`M10 ${y} H150 C220 ${y} 230 ${ty} ${tx} ${ty}`} className={l.posterLine} />
                <path d={`M10 ${y + 5} H150 C220 ${y + 5} 230 ${ty + 5} ${tx} ${ty + 5}`} className={l.posterLine2} />
                <circle cx={tx} cy={ty + 2.5} r="3" className={l.posterNode} />
              </g>
            );
          })}
          <text x="470" y="212" textAnchor="end" className={l.posterLabel}>illustration</text>
        </svg>
        <div className={s.body}>
          <p>{translate({id: 'rails.s8.p1', message: 'Further out: methods that communities have measured, connected pair by pair into a network — each on terms its community sets.'})}</p>
          <p>{translate({id: 'rails.s8.p2', message: 'The network, the leaderboard and the benchmark queue are infrastructure you can plug into. You do not need any of them to start.'})}</p>
          <p><Link to="/vision">{translate({id: 'rails.s8.cta', message: 'See the long vision →'})}</Link></p>
        </div>
      </div>
    </Register>
  );
}
