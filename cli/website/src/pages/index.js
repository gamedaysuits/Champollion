import React, {useEffect, useRef} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import Translate, {translate} from '@docusaurus/Translate';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import Reveal from '../components/Reveal';
import Interlinear from '../components/home/Interlinear';
import {CopyBox, Term, TermSheetProvider, LicenceBand, loadGsap, TEAL_RGB} from '../components/home/parts';
import {RELEASE} from '../components/rails/release.mjs';
import {facts} from '../utils/railsDemo.mjs';
import {addLockPop} from '../utils/lockPop.mjs';
import recording from '../data/rails-demo/recording.json';
import h from '../components/home/home.module.css';

/* ====================================================================
   Homepage (/) — v7, the founder-approved draft (2026-10-12, "1, yes"):
   docs/site-drafts/rails-home-2026-10-12/ on rails/on-rails, with its
   first-visit walkthrough docs/WEBSITE_FTUE_2026-10-12.md.

   Copy and hierarchy are the founder's, kept exactly: ONE phrase, "Machine
   translation development and deployment on rails with guardrails" (founder
   correction 2026-10-12: never split into a separate "On rails, with
   guardrails." line), then "Built with low-resource and Indigenous language
   communities in mind." Two doors:
   Start a project / Join a project. Only the agent path is up front; the
   terminal path is one quiet link.

   Brand: DESIGN.md tokens (scholarly teal; the triad only as a hairline;
   flat surfaces; glass over ≤8% washes). The house lock-and-pop on four
   things only: "with guardrails.", Start a project, the chat's lock, the
   licence button — plus the copy tick.

   Truth rules that hold whatever the design: the "Not released yet" pill
   follows release.json; the chat is labelled an illustration and its numbers
   come from the recorded walk (railsDemo facts), never typed; the agent
   caveat (a cloud agent sends what it reads) stays visible.
   ==================================================================== */

const MCP_SETTING = '{"mcpServers": {"champollion": {\n  "command": "npx",\n  "args": ["-y", "champollion-mcp-server"]\n}}}';
const MCP_SETTING_FLAT = '{"mcpServers":{"champollion":{"command":"npx","args":["-y","champollion-mcp-server"]}}}';

const F = facts(recording);
const FIRST = F.files[0]; // the first file the recorded person brought in
const FIRST_NAME = FIRST.from.split('/').pop();

const Tick = () => (
  <span className={h.tick} aria-hidden="true">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5 9-10" /></svg>
  </span>
);

function Hero({guardRef, startRef}) {
  return (
    <>
      <h1 className={`${h.h1} ${h.h1Phrase}`}>
        <Translate
          id="home.v8.h1"
          description="homepage H1, the founder's one phrase; {guard} is 'with guardrails', which locks and pops"
          values={{guard: <span className={h.guardWords} ref={guardRef}>{translate({id: 'home.v8.h1.guard', message: 'with guardrails'})}</span>}}>
          {'Machine translation development and deployment on rails {guard}'}
        </Translate>
      </h1>
      <span className={`${h.triad} ${h.heroTriad}`} aria-hidden="true" />
      <p className={h.sub}>
        {translate({id: 'home.v7.sub', message: 'Built with low-resource and Indigenous language communities in mind.', description: 'the line under the brand line (the founder’s words)'})}
      </p>
      <div className={h.doors}>
        <a ref={startRef} className={`${h.btn} ${h.btnLg} ${h.primary}`} href="#start">
          {translate({id: 'home.v7.start', message: 'Start a project'})} <span className={h.arrow} aria-hidden="true">→</span>
        </a>
        <Link className={`${h.btn} ${h.btnLg} ${h.glassBtn}`} to="/join">
          {translate({id: 'home.v7.join', message: 'Join a project'})}
        </Link>
      </div>
    </>
  );
}

function AgentPath({chatRef, lockRef, shackleRef}) {
  const sentence = translate({id: 'home.v7.say', message: 'We want to build a translator from English to our language — use champollion.', description: 'the sentence a person tells their AI agent'});
  return (
    <>
      <div className={h.agentPath} id="start" data-lamp-zone="">
        <Interlinear className={h.lines} />
        <div className={`${h.glass} ${h.how}`} data-glass="">
          <div className={h.howTop}>
            <h2 className={h.howTitle}>{translate({id: 'home.v7.agent.title', message: 'Start with your AI agent'})}</h2>
            {!RELEASE.released && (
              <span className={h.soon}>
                {translate({id: 'home.v7.agent.soon', message: 'Not released yet · arrives with the next release', description: 'pill while the rails are unreleased (release.json)'})}
              </span>
            )}
          </div>
          <div className={h.step}>
            <span className={h.stepLabel}>{translate({id: 'home.v7.agent.s1', message: '1 · Add the rails to your agent'})}</span>
            <CopyBox json text={MCP_SETTING_FLAT} label={translate({id: 'home.v7.agent.copySetting', message: 'Copy the setting'})}>{MCP_SETTING}</CopyBox>
            <p className={h.hint}>
              <Translate
                id="home.v7.agent.s1hint"
                description="{how} and {self} are links"
                values={{
                  how: <Link to="/docs/network/getting-started/mcp-server">{translate({id: 'home.v7.agent.s1how', message: 'how, for each agent'})}</Link>,
                  self: <Link to="/start">{translate({id: 'home.v7.agent.s1self', message: 'let your agent set it up'})}</Link>,
                }}>
                {'Paste it into your agent’s MCP settings ({how}) — or {self}.'}
              </Translate>
            </p>
          </div>
          <div className={h.step}>
            <span className={h.stepLabel}>{translate({id: 'home.v7.agent.s2', message: '2 · Tell it, in your own words'})}</span>
            <CopyBox say text={sentence} label={translate({id: 'home.v7.agent.copySentence', message: 'Copy the sentence'})}>{sentence}</CopyBox>
          </div>
          <div className={h.step}>
            <span className={h.stepLabel}>{translate({id: 'home.v7.agent.s3', message: '3 · Answer what it asks'})}</span>
            <p className={h.note}>{translate({id: 'home.v7.agent.s3note', message: 'Where your sentences may go, and what ships, stay your calls.'})}</p>
            <p className={h.hint}>
              {translate({id: 'home.v7.agent.caveat', message: 'The tools show your agent counts, not your sentences. An agent that runs on a company’s servers sends whatever it reads there — for protected sentences, use one that runs on your computer.', description: 'the data-flow caveat for cloud-hosted agents'})}
            </p>
          </div>
          <p className={h.quiet}>
            <Translate
              id="home.v7.agent.quiet"
              description="{commands} is a link to the terminal path"
              values={{commands: <Link to="/docs/agents/shell">{translate({id: 'home.v7.agent.commands', message: 'See the commands'})}</Link>}}>
              {'Works with any agent that speaks MCP. Prefer a terminal? {commands}.'}
            </Translate>
          </p>
        </div>

        <figure ref={chatRef} className={`${h.glass} ${h.chat}`} data-glass="" data-play=""
          aria-label={translate({id: 'home.v7.chat.label', message: 'An illustration: an agent working on the rails with a family'})}>
          <div className={h.chatHead}>{translate({id: 'home.v7.chat.head', message: 'Your agent, on the rails'})}</div>
          <div className={`${h.msg} ${h.you}`}>{sentence}</div>
          <div className={`${h.msg} ${h.bot} ${h.msgBot}`}>
            <Translate
              id="home.v7.chat.m1"
              description="{pair} is bold"
              values={{pair: <strong>{translate({id: 'home.v7.chat.pair', message: 'English → Our language'})}</strong>}}>
              {'Started {pair}. Your files stay on this computer.'}
            </Translate>
          </div>
          <div className={`${h.msg} ${h.bot} ${h.msgBot}`}>
            <Translate
              id="home.v7.chat.m2"
              description="{count} is bold, e.g. '40 sentence pairs'; {file} is a file name; numbers come from the recorded walk"
              values={{
                count: <strong><Translate id="home.v7.chat.count" values={{n: String(FIRST.pairs)}}>{'{n} sentence pairs'}</Translate></strong>,
                file: <span translate="no">{FIRST_NAME}</span>,
              }}>
              {'I found {count} in {file}. Your sentences stay with you — I only see counts.'}
            </Translate>
          </div>
          <div className={`${h.msg} ${h.bot} ${h.ask} ${h.msgBot}`}>
            {translate({id: 'home.v7.chat.m3', message: 'Before anything learns from them: who holds them, and may a model be trained on them?'})}
            <span className={h.chip}>
              <svg ref={lockRef} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path ref={shackleRef} d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              {translate({id: 'home.v7.chat.chip', message: 'Your call, always'})}
            </span>
          </div>
        </figure>
      </div>
      <p className={h.caption}>
        {translate({id: 'home.v7.chat.caption', message: 'An illustration — the family and its sentences are invented.'})}
      </p>
    </>
  );
}

function ThreeRails() {
  const cards = [
    {
      n: '01',
      title: translate({id: 'home.v7.rails.build', message: 'Build'}),
      body: (
        <Translate
          id="home.v7.rails.buildBody"
          description="{testSet} is a term with a tooltip"
          values={{testSet: <Term id="test" word={translate({id: 'home.v7.term.testSet', message: 'test set'})}
            tip={translate({id: 'home.v7.term.testSetTip', message: 'Sentences a fluent speaker checked, locked away before training. No model learns from them, so the score on them is honest.'})} />}}>
          {'A translator for your language, from the sentences and word lists you already have — measured on a {testSet} you keep.'}
        </Translate>
      ),
      link: {to: '/start', label: translate({id: 'home.v7.rails.buildLink', message: 'Start a project'})},
    },
    {
      n: '02',
      title: translate({id: 'home.v7.rails.host', message: 'Host'}),
      body: translate({id: 'home.v7.rails.hostBody', message: 'A sealed bounty on your own test set. Builders compete without ever seeing it; you set the prize terms.'}),
      link: {to: '/docs/network/sovereignty/run-a-sovereign-contest', label: translate({id: 'home.v7.rails.hostLink', message: 'How bounties work'})},
    },
    {
      n: '03',
      title: translate({id: 'home.v7.rails.serve', message: 'Serve'}),
      body: translate({id: 'home.v7.rails.serveBody', message: 'Your own translation service, or your app and site translated — the same pipeline you measured, on new text.'}),
      link: {to: '/translate', label: translate({id: 'home.v7.rails.serveLink', message: 'Deploy a translator'})},
    },
  ];
  return (
    <section className={`${h.block} ${h.railsSec}`}>
      <div className={h.wrap}>
        <Reveal>
          <div className={h.kicker}>{translate({id: 'home.v7.rails.kicker', message: 'Three rails'})}</div>
          <h2 className={h.big}>{translate({id: 'home.v7.rails.title', message: 'From your first sentences to a running service.'})}</h2>
        </Reveal>
        <div className={h.three}>
          {cards.map((c, i) => (
            <Reveal key={c.n} delay={i * 80}>
              <div className={`${h.glass} ${h.card}`}>
                <span className={h.num} translate="no">{c.n}</span>
                <h3 className={h.cardTitle}>{c.title}</h3>
                <p>{c.body}</p>
                <Link className={h.more} to={c.link.to}>{c.link.label} <span className={h.arrow} aria-hidden="true">→</span></Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Guardrails() {
  const guards = [
    {
      t: translate({id: 'home.v7.g.local', message: 'Local-first'}),
      p: translate({id: 'home.v7.g.localBody', message: 'Your files are read where they sit. No sentence leaves without its holders’ yes.'}),
    },
    {
      t: translate({id: 'home.v7.g.test', message: 'A private test set'}),
      p: translate({id: 'home.v7.g.testBody', message: 'Locked away before training; every look at it is counted.'}),
    },
    {
      t: translate({id: 'home.v7.g.leak', message: 'Leak audits'}),
      p: (
        <Translate
          id="home.v7.g.leakBody"
          description="{twins} is a term with a tooltip"
          values={{twins: <Term id="twin" word={translate({id: 'home.v7.term.twins', message: 'near-twins'})}
            tip={translate({id: 'home.v7.term.twinsTip', message: 'Training sentences a word or two away from a test sentence. Left in, they make a model look better than it is.'})} />}}>
          {'Test copies and {twins} are set aside before training.'}
        </Translate>
      ),
    },
    {
      t: translate({id: 'home.v7.g.predict', message: 'Predictions first'}),
      p: translate({id: 'home.v7.g.predictBody', message: 'You write down what you expect before any score exists.'}),
    },
    {
      t: translate({id: 'home.v7.g.gains', message: 'Only real gains'}),
      p: translate({id: 'home.v7.g.gainsBody', message: 'Each new model is compared with the last, and the comparison says whether a gain is real or noise.'}),
    },
    {
      t: translate({id: 'home.v7.g.honest', message: 'Honest about quality'}),
      p: (
        <Translate
          id="home.v7.g.honestBody"
          description="{phrasebook} is a term with a tooltip"
          values={{phrasebook: <Term id="phrase" word={translate({id: 'home.v7.term.phrasebook', message: 'phrasebook'})}
            tip={translate({id: 'home.v7.term.phrasebookTip', message: 'A model that handles familiar phrases like the ones it learned from, and little else yet — the honest first result from a small collection.'})} />}}>
          {'A small model is called what it is: a {phrasebook}.'}
        </Translate>
      ),
    },
  ];
  return (
    <section className={h.block}>
      <div className={`${h.wrap} ${h.split}`}>
        <Reveal>
          <div className={h.kicker}>{translate({id: 'home.v7.g.kicker', message: 'With guardrails'})}</div>
          <h2 className={h.big}>{translate({id: 'home.v7.g.title', message: 'Your agent does the steps. You make the calls that matter.'})}</h2>
          <p className={h.lead}>{translate({id: 'home.v7.g.lead', message: 'Where your sentences may go, what counts as good enough, and what ships.'})}</p>
          <Link className={h.more} to="/your-data">{translate({id: 'home.v7.g.data', message: 'Where your data goes'})} <span className={h.arrow} aria-hidden="true">→</span></Link>
        </Reveal>
        <Reveal className={h.guards}>
          {guards.map((g) => (
            <div key={g.t}>
              <h3 className={h.guardTitle}><Tick />{g.t}</h3>
              <p>{g.p}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <Reveal as="section" className={h.closing}>
      <div className={h.wrap}>
        <h2>{translate({id: 'home.v7.close.title', message: 'Start with the sentences you already have.'})}</h2>
        <p>
          <Translate
            id="home.v7.close.talk"
            description="{talk} is a mailto link; services are 'let's talk', never priced"
            values={{talk: <a href="mailto:info@champollion.dev?subject=Let%E2%80%99s%20talk">{translate({id: 'home.v7.close.talkLink', message: 'Let’s talk.'})}</a>}}>
            {'Having trouble, or want help with your project? {talk}'}
          </Translate>
        </p>
        <div className={h.doors}>
          <a className={`${h.btn} ${h.btnLg} ${h.primary}`} href="#start">{translate({id: 'home.v7.start', message: 'Start a project'})} <span className={h.arrow} aria-hidden="true">→</span></a>
          <Link className={`${h.btn} ${h.btnLg} ${h.glassBtn}`} to="/join">{translate({id: 'home.v7.join', message: 'Join a project'})}</Link>
        </div>
      </div>
    </Reveal>
  );
}

/** The motion: the guardrails line locks, Start pops after it, the chat plays
 * once as it comes into view (its lock closes on the consent question), and the
 * licence button pops once as it arrives. Off under reduced motion; nothing is
 * ever hidden unless script is running (html[data-js]). */
function useHomeMotion({guardRef, startRef, chatRef, lockRef, shackleRef, licRef}) {
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-home-live', '');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const chat = chatRef.current;
    const armed = html.hasAttribute('data-js') && !calm;
    if (!armed) {
      chat?.removeAttribute('data-play');
      return () => html.removeAttribute('data-home-live');
    }
    let alive = true;
    const observers = [];
    const timers = [];
    const wait = (ms) => new Promise((r) => { timers.push(setTimeout(r, ms)); });
    loadGsap().then((gsap) => {
      if (!alive) return;
      const rgb = TEAL_RGB();
      const tl = gsap.timeline();
      const locked = addLockPop(gsap, tl, guardRef.current, 1.05,
        {rgb, origin: '0% 60%', peak: 1.05, peakBright: 1.22, chargeBright: 1.06, restGlow: 4, rest: 0.3, noTransition: true, fromRest: true});
      addLockPop(gsap, tl, startRef.current, locked - 0.15,
        {rgb, peak: 1.05, peakBright: 1.2, peakGlow: 12, restGlow: 0, rest: 0, clear: true, noTransition: true, fromRest: true});

      // the licence button, once, as it arrives
      const lic = licRef.current;
      if (lic) {
        const io = new IntersectionObserver(([e], o) => {
          if (!e.isIntersecting) return;
          o.disconnect();
          addLockPop(gsap, gsap.timeline({delay: 0.5}), lic, 0,
            {rgb, peak: 1.05, peakBright: 1.2, peakGlow: 12, restGlow: 0, rest: 0, clear: true, noTransition: true, fromRest: true});
        }, {threshold: 0.9});
        io.observe(lic);
        observers.push(io);
      }

      // the chat plays once; the consent question lands with the lock, which closes
      if (chat) {
        const msgs = [...chat.querySelectorAll(`.${h.msgBot}`)];
        gsap.set(shackleRef.current, {y: -4.5});
        const io = new IntersectionObserver(async ([e]) => {
          if (!e.isIntersecting) return;
          io.disconnect();
          await wait(500);
          for (const m of msgs) {
            if (!alive) return;
            const typing = document.createElement('div'); // sits where the message will be: no layout shift
            typing.className = h.typing;
            typing.setAttribute('aria-hidden', 'true');
            typing.innerHTML = '<i></i><i></i><i></i>';
            typing.style.left = `${m.offsetLeft}px`;
            typing.style.top = `${m.offsetTop}px`;
            chat.append(typing);
            await wait(700);
            typing.remove();
            m.style.opacity = '1';
            m.style.transform = 'none';
            if (m.classList.contains(h.ask)) {
              addLockPop(gsap, gsap.timeline({delay: 0.3}), lockRef.current, 0,
                {rgb, peak: 1.3, restGlow: 3, rest: 0.45, fromRest: true,
                  onLock: () => gsap.to(shackleRef.current, {y: 0, duration: 0.12, ease: 'back.out(3)'})});
            }
            await wait(300);
          }
        }, {threshold: 0.5});
        io.observe(chat);
        observers.push(io);
      }
    }).catch(() => {
      // gsap failed to load: show the finished composition
      chat?.removeAttribute('data-play');
    });
    return () => {
      alive = false;
      observers.forEach((o) => o.disconnect());
      timers.forEach(clearTimeout);
      html.removeAttribute('data-home-live');
    };
  }, []);
}

export default function Home() {
  const guardRef = useRef(null);
  const startRef = useRef(null);
  const chatRef = useRef(null);
  const lockRef = useRef(null);
  const shackleRef = useRef(null);
  const licRef = useRef(null);
  const links = useBrokenLinks();
  links.collectAnchor('start');
  links.collectAnchor('licence');
  useHomeMotion({guardRef, startRef, chatRef, lockRef, shackleRef, licRef});

  return (
    <Layout
      title={translate({id: 'home.v8.seo.title', message: 'Machine translation development and deployment on rails with guardrails'})}
      description={translate({id: 'home.v8.seo.description', message: 'Machine translation development and deployment on rails with guardrails. Built with low-resource and Indigenous language communities in mind.'})}>
      <TermSheetProvider>
        <main className={h.page} data-home-v7="">
          <div className={h.field} aria-hidden="true" />
          <section className={h.hero}>
            <div className={h.wrap}>
              <Hero guardRef={guardRef} startRef={startRef} />
              <AgentPath chatRef={chatRef} lockRef={lockRef} shackleRef={shackleRef} />
            </div>
          </section>
          <ThreeRails />
          <Guardrails />
          <div className={h.wrap}>
            <Reveal>
              <LicenceBand buttonRef={licRef} />
            </Reveal>
          </div>
          <Closing />
        </main>
      </TermSheetProvider>
    </Layout>
  );
}
