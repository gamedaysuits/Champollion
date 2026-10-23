import React, {useMemo, useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import {translate} from '@docusaurus/Translate';
import Register, {Caveat, Cmd, PreRelease} from '../components/rails/Register';
import {RELEASE} from '../components/rails/release.mjs';
import {LetsTalk, F} from '../components/rails/sections';
import {C, newCommand} from '../components/rails/commands.mjs';
import s from '../components/rails/rails.module.css';
import st from '../components/rails/Start.module.css';
import site from '../data/rails-demo/site-data.json';

/* ====================================================================
   /start — "Start building". Two ways in, both on your own computer:
   hand it to your agent (an agent-agnostic prompt for the rails MCP
   profile), or run the commands yourself. A language field fills in the
   first real command; empty, it shows the private-use example (qaa).
   The prompt ASKS the agent to keep out of the data; the page says plainly
   that asking is not a lock.
   ==================================================================== */


export function buildPrompt(language, from) {
  const to = String(language || '').trim() || 'my language';
  const src = String(from || '').trim() || 'English';
  return [
    `Help me build a machine-translation method from ${src} to ${to} with Champollion, on this computer.`,
    '',
    `1. Add the Champollion MCP server using whatever mechanism this environment supports. It runs over stdio as: npx -y ${RELEASE.pin('champollion-mcp-server')}`,
    '2. Call its start_project tool, then follow the steps it returns, one at a time.',
    '3. When a step says only I can answer — who holds a file, whether a model may learn from it, whether its text may leave this computer, what we expect, whether a result is good enough — ask me, and never answer for me.',
    '4. Do not open or read my data files yourself. Bring them in with the add_data tool, which reports counts and columns, never sentences.',
  ].join('\n');
}

function Copy({text, label}) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={st.copy} onClick={() => {
      const ok = () => { setDone(true); setTimeout(() => setDone(false), 2200); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, () => {});
    }}>
      {done ? translate({id: 'rails.start.copied', message: 'Copied'}) : label}
    </button>
  );
}

export default function Start() {
  const [lang, setLang] = useState('');
  const [from, setFrom] = useState('English');
  const prompt = useMemo(() => buildPrompt(lang, from), [lang, from]);
  const first = useMemo(() => newCommand(lang, {from: from || 'English'}), [lang, from]);
  return (
    <Layout
      title={translate({id: 'rails.start.seo.title', message: 'Start building'})}
      description={translate({id: 'rails.start.seo.description', message: 'Start a machine-translation project for your language on your own computer: hand it to your AI agent, or run the commands yourself.'})}>
      <main className={s.page}>
        <header className={st.head}>
          <div className={s.wrap}>
            <PreRelease />
            <p className={st.kicker}>{translate({id: 'rails.start.kicker', message: 'Start building'})}</p>
            <h1 className={st.h1}>{translate({id: 'rails.start.h1', message: 'Two ways in. The tools run on your computer either way.'})}</h1>
            <p className={s.lede}>{translate({id: 'rails.start.lede', message: 'Tell the tools which languages, and they set up a project with a place for everything. Then they take you one step at a time, and stop to ask the questions only you and the people who hold your data can answer.'})}</p>
            <div className={st.langRow}>
              <label className={st.field}>
                <span>{translate({id: 'rails.start.from', message: 'From'})}</span>
                <input value={from} onChange={(e) => setFrom(e.target.value)} autoComplete="off" spellCheck="false" />
              </label>
              <label className={st.field}>
                <span>{translate({id: 'rails.start.to', message: 'Into your language (its name or code)'})}</span>
                <input value={lang} onChange={(e) => setLang(e.target.value)} placeholder={translate({id: 'rails.start.placeholder', message: 'e.g. its name, as its speakers write it'})} autoComplete="off" spellCheck="false" />
              </label>
            </div>
            <p className={st.hint}>{translate({id: 'rails.start.hint', message: 'If the tools do not know the name, they offer close matches for you to choose — they never pick for you. A language with no code yet gets a private one.'})}</p>
          </div>
        </header>

        <Register n="01" kicker={translate({id: 'rails.start.a.kicker', message: 'With your agent'})} id="agent"
          title={translate({id: 'rails.start.a.title', message: 'Hand it to your agent.'})}>
          <p className={s.body}>{translate({id: 'rails.start.a.body', message: 'Paste this into an AI agent that can use tools (MCP). In our tests most of the models we tried got all the way; the smallest struggled.'})}</p>
          <div className={st.promptBox}>
            <pre className={st.prompt} dir="ltr">{prompt}</pre>
            <Copy text={prompt} label={translate({id: 'rails.start.copy', message: 'Copy the prompt'})} />
          </div>
          <div className={st.note}>
            <Caveat label={translate({id: 'rails.start.a.caveat.label', message: 'Asking is not a lock'})}>
              {translate({id: 'rails.start.a.caveat', message: 'Point 4 asks the agent to stay out of your files; nothing forces it to. If your agent’s model runs on a company’s servers — as most assistant apps’ do, even installed on your computer — and your sentences must not leave it, use an agent whose model runs on this computer, or do it yourself below.'})}{' '}
              <Link to="/your-data">{translate({id: 'rails.start.a.caveat.link', message: 'Where your data goes →'})}</Link>
            </Caveat>
          </div>
        </Register>

        <Register n="02" kicker={translate({id: 'rails.start.b.kicker', message: 'Yourself'})} id="yourself"
          title={translate({id: 'rails.start.b.title', message: 'Or do it yourself.'})}>
          <ol className={st.steps}>
            <li>
              <span className={st.stepT}>{translate({id: 'rails.start.b.1', message: 'Install the project tool (it needs Node.js'})} <span translate="no">{site.requirements.node}</span>):</span>
              <Cmd block>{C.installCli.cmd}</Cmd>
            </li>
            <li>
              <span className={st.stepT}>{translate({id: 'rails.start.b.2', message: 'Start the project:'})}</span>
              <Cmd block>{first}</Cmd>
            </li>
            <li>
              <span className={st.stepT}>{translate({id: 'rails.start.b.3', message: 'Then, at every step, ask what to do next:'})}</span>
              <Cmd block>{C.next.cmd}</Cmd>
            </li>
          </ol>
          <p className={s.body}>
            {translate({id: 'rails.start.b.licence', message: 'The tools are source-available and free for noncommercial use: a school, a charity, a public hospital or clinic, a government office, or a personal or research project is covered; a business’s product is not.'})}{' '}
            <Link to="/docs/getting-started/who-may-use-this">{translate({id: 'rails.start.b.licenceLink', message: 'Who may use this →'})}</Link>
          </p>
          <p className={s.body}>
            {translate({id: 'rails.start.b.4', message: 'When it is time to train, the rails ask before installing the training tools (Python 3.12, through uv):'})} <Cmd>{C.installForge.cmd}</Cmd>
          </p>
          <p className={s.body}>
            {translate({id: 'rails.start.b.offline', message: 'Working offline? Install the tools while you have the internet. An installed tool may fetch a language’s card from Champollion’s public index — it sends the language’s code, never your files — and checks for updated cards once a day; that host sees your computer’s internet address, as any website does. To stop those lookups, set this in your shell and in your agent’s MCP server settings:'})} <Cmd>{C.offline.cmd}</Cmd>
          </p>
        </Register>

        <Register n="03" kicker={translate({id: 'rails.start.c.kicker', message: 'What to expect'})} id="expect"
          title={translate({id: 'rails.start.c.title', message: 'What to expect from a first model.'})}>
          <Caveat label={translate({id: 'rails.start.c.label', message: 'Said plainly'})}>
            <p className={st.p}>{translate({id: 'rails.start.c.1', message: 'On a laptop, with the sentences a family or a classroom has, the first model is usually a phrasebook: it handles phrases like the ones it learned from, and not much else. The training tool says so itself:'})} <q translate="no">{F.expect}</q></p>
            <p className={st.p}>{translate({id: 'rails.start.c.2', message: 'What the rails guarantee is that you will know how good it is — measured on your checked sentences, which no model trains on (the tools also count how many of them nearly repeat a training sentence); if you have a word list, compared with simply looking words up, on the dev sentences; and checked against the prediction you wrote before any score. More sentences, checked by fluent speakers, are what move the score.'})}</p>
          </Caveat>
          <div className={s.grid3} style={{marginTop: 22}}>
            <div className={`${s.card} ${s.guarded}`}>
              <h3>{translate({id: 'rails.start.d.1', message: 'Files the tools bring in start local-only'})}</h3>
              <p>{translate({id: 'rails.start.d.1b', message: 'The tools keep their text on this computer until their holders say otherwise.'})}</p>
            </div>
            <div className={`${s.card} ${s.guarded}`}>
              <h3>{translate({id: 'rails.start.d.2', message: 'Your test set is protected'})}</h3>
              <p>{translate({id: 'rails.start.d.2b', message: 'No model learns from it, and every time the tools score or screen it, that is counted.'})}</p>
            </div>
            <div className={`${s.card} ${s.guarded}`}>
              <h3>{translate({id: 'rails.start.d.3', message: 'Training waits for your yes'})}</h3>
              <p>{translate({id: 'rails.start.d.3b', message: 'The rails tell your agent to ask you first. Training runs on this computer, stops itself if it stalls, and is never billed.'})}</p>
            </div>
          </div>
          <p style={{marginTop: 20}}><Link to="/docs/agents/shell">{translate({id: 'rails.start.guide', message: 'The whole guide, step by step →'})}</Link></p>
        </Register>

        <LetsTalk n="04" />
      </main>
    </Layout>
  );
}
