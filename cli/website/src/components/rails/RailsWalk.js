import React, {useEffect, useMemo, useRef, useState} from 'react';
import {translate} from '@docusaurus/Translate';
import recording from '../../data/rails-demo/recording.json';
import script from '../../data/rails-demo/script.json';
import {chapters as buildChapters, transcript} from '../../utils/railsDemo.mjs';
import w from './RailsWalk.module.css';

/**
 * RailsWalk — the homepage figure: an agent-forward workspace replaying a
 * RECORDED walk of the rails ("recorded, not written").
 *
 *   Files | conversation | terminal, with a status bar.
 *   - The terminal shows only what was recorded (recording.json): tool calls,
 *     the commands the rails ran, what they printed, what they asked.
 *   - The conversation is WRITTEN (script.json) and labelled so; the answers
 *     the person gives inside it come from the recording.
 *   - The language is "Our language" (qaa, a private-use code), so no real
 *     community is depicted; the grandfather is a role, never a person.
 *
 * Server-rendered on the "Decide" chapter (the moment the people decide where
 * their data may go), with the whole walk as a text transcript below — so a
 * reader without JavaScript, a screen reader or an agent gets everything.
 * With JavaScript it plays forward ONCE when scrolled into view (never with
 * reduced motion), always with a pause control (WCAG 2.2.2). Nothing loops.
 */

const START = 'protect';
const STEP_MS = 7000;


function Lock({kind}) {
  if (!kind) return null;
  const title = kind === 'decided'
    ? translate({id: 'rails.walk.lock.decided', message: 'Local-only: decided by its holders'})
    : translate({id: 'rails.walk.lock.default', message: 'Local-only: the project’s default until its holders decide'});
  return (
    <span className={kind === 'decided' ? w.lockDecided : w.lockDefault} title={title} aria-label={title} role="img">
      <svg viewBox="0 0 12 14" width="11" height="13" aria-hidden="true">
        <rect x="1" y="6" width="10" height="7.5" rx="1.4" />
        <path d="M3.4 6V4.2a2.6 2.6 0 0 1 5.2 0V6" />
      </svg>
    </span>
  );
}

function FilesPane({files}) {
  const groups = {};
  for (const f of files) {
    const dir = f.path.slice(0, f.path.lastIndexOf('/') + 1);
    (groups[dir] = groups[dir] || []).push(f);
  }
  const dirs = Object.keys(groups);
  return (
    <div className={w.files} aria-label={translate({id: 'rails.walk.files', message: 'Files in the project'})}>
      <div className={w.paneLabel}>{translate({id: 'rails.walk.files.label', message: 'Files'})}</div>
      <ul className={w.tree} dir="ltr" translate="no">
        <li className={w.dir}>family/</li>
        <li className={w.dirSub}>inbox/</li>
        {dirs.length === 0 && <li className={w.empty}>data/</li>}
        {dirs.map((d) => (
          <React.Fragment key={d}>
            <li className={w.dirSub}>{d}</li>
            {groups[d].map((f) => (
              <li key={f.path} className={w.file}>
                <span className={w.fileName}>{f.path.slice(d.length)}</span>
                <Lock kind={f.lock} />
                {f.counted && <span className={w.counted} title={translate({id: 'rails.walk.counted', message: 'Every scoring run on this test set is counted'})}>scoring counted</span>}
              </li>
            ))}
          </React.Fragment>
        ))}
      </ul>
    </div>
  );
}

function Answers({answers}) {
  if (!answers) return null;
  return (
    <div className={w.answers}>
      <span className={w.recordedTag}>{translate({id: 'rails.walk.answersRecorded', message: 'their answer, as recorded'})}</span>
      <dl className={w.answerList} translate="no">
        {Object.entries(answers).map(([k, v]) => (
          <div key={k} className={w.answer}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}

function Conversation({chapter}) {
  return (
    <div className={w.chat} aria-live="polite">
      <div className={w.paneLabel}>
        {translate({id: 'rails.walk.chat.label', message: 'Conversation'})}
        <span className={w.writtenTag}>{translate({id: 'rails.walk.chat.written', message: 'written for this illustration'})}</span>
      </div>
      <ol className={w.bubbles}>
        {chapter.lines.map((l) => (
          <li key={l.id} className={l.who === 'person' ? w.person : w.agent}>
            <span className={w.who}>{l.who === 'person' ? translate({id: 'rails.walk.who.person', message: 'Grandson'}) : translate({id: 'rails.walk.who.agent', message: 'Agent'})}</span>
            {translate({id: l.id, message: l.text})}
          </li>
        ))}
      </ol>
      <Answers answers={chapter.answers} />
    </div>
  );
}

function Terminal({chapter, animate}) {
  return (
    <div className={w.term}>
      <div className={w.paneLabel}>
        {translate({id: 'rails.walk.term.label', message: 'Terminal'})}
        <span className={w.recordedTag}>{translate({id: 'rails.walk.term.recorded', message: 'recorded'})}</span>
      </div>
      <div className={w.termBody} dir="ltr" translate="no" key={animate ? chapter.id : undefined}>
        {chapter.terminal.map((l, i) => (
          <div key={i} className={`${w.line} ${w[l.kind] || ''} ${animate ? w.inscribe : ''}`} style={animate ? {animationDelay: `${Math.min(i, 14) * 70}ms`} : undefined}>
            {l.kind === 'cmd' && <span className={w.prompt} aria-hidden="true">$ </span>}
            {l.kind === 'tool' && <span className={w.arrow} aria-hidden="true">→ </span>}
            {l.kind === 'ask' && <span className={w.askTag}>{'the rails ask the person: '}</span>}
            {l.kind === 'note' && <span className={w.askTag}>{'for a person: '}</span>}
            {l.kind === 'did' && <span className={w.askTag}>{'the person did: '}</span>}
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RailsWalk() {
  const all = useMemo(() => buildChapters(recording, script), []);
  const steps = useMemo(() => transcript(recording), []);
  const startAt = Math.max(0, all.findIndex((c) => c.id === START));
  const [at, setAt] = useState(startAt);
  const [playing, setPlaying] = useState(false);
  const [animate, setAnimate] = useState(false);
  const played = useRef(false);
  const root = useRef(null);

  // Autoplay forward once, when in view, unless the reader prefers less motion.
  useEffect(() => {
    if (typeof window === 'undefined' || !root.current) return undefined;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    setAnimate(true);
    const io = new IntersectionObserver((entries) => {
      if (!played.current && entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) {
        played.current = true;
        setPlaying(true);
      }
    }, {threshold: [0.5]});
    io.observe(root.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    if (at >= all.length - 1) { setPlaying(false); return undefined; }
    const id = setTimeout(() => setAt((x) => Math.min(x + 1, all.length - 1)), STEP_MS);
    return () => clearTimeout(id);
  }, [playing, at, all.length]);

  const go = (i) => { setPlaying(false); setAt(Math.max(0, Math.min(i, all.length - 1))); };
  const chapter = all[at];
  const stage = recording.steps.slice(0, chapter.at + 1).reverse()
    .map((s) => s.stage || (s.result && s.result.next && s.result.next.stage)).find(Boolean);
  const locked = chapter.files.filter((f) => f.lock).length;

  return (
    <figure className={w.figure} ref={root} aria-labelledby="rails-walk-caption">
      <div className={w.window}>
        <div className={w.bar}>
          <span className={w.dots} aria-hidden="true"><i /><i /><i /></span>
          <span className={w.title} dir="ltr" translate="no">~/family — champollion</span>
          <span className={w.chip}>{translate({id: 'rails.walk.chip', message: 'Illustration · real commands · synthetic data · stand-in model'})}</span>
        </div>

        <nav className={w.chapters} aria-label={translate({id: 'rails.walk.chapters', message: 'Chapters of the walk'})}>
          {all.map((c, i) => (
            <button key={c.id} type="button" className={i === at ? w.chapterOn : w.chapterBtn}
              aria-current={i === at ? 'step' : undefined} onClick={() => go(i)}>
              <span className={w.chapterN} translate="no">{i + 1}</span> {translate({id: `rails.walk.ch.${c.id}`, message: c.title})}
            </button>
          ))}
        </nav>

        <div className={w.panes}>
          <FilesPane files={chapter.files} />
          <Conversation chapter={chapter} />
          <Terminal chapter={chapter} animate={animate} />
        </div>

        <div className={w.statusBar}>
          <span translate="no" dir="ltr">{stage && `stage ${stage}`}</span>
          <span className={w.guardStat}>
            <Lock kind="decided" /> {translate({id: 'rails.walk.status.localOnly', message: 'local-only files:'})} {locked}
          </span>
          <span className={w.controls}>
            <button type="button" onClick={() => go(at - 1)} disabled={at === 0} aria-label={translate({id: 'rails.walk.prev', message: 'Previous chapter'})}>◀</button>
            {playing
              ? <button type="button" onClick={() => setPlaying(false)} aria-label={translate({id: 'rails.walk.pause', message: 'Pause'})}>❚❚ {translate({id: 'rails.walk.pauseText', message: 'Pause'})}</button>
              : <button type="button" onClick={() => { if (at >= all.length - 1) setAt(0); setPlaying(true); }} aria-label={translate({id: 'rails.walk.play', message: 'Play the walk'})}>▶ {at >= all.length - 1 ? translate({id: 'rails.walk.replay', message: 'From the start'}) : translate({id: 'rails.walk.playText', message: 'Play'})}</button>}
            <button type="button" onClick={() => go(at + 1)} disabled={at === all.length - 1} aria-label={translate({id: 'rails.walk.next', message: 'Next chapter'})}>▶▶</button>
          </span>
        </div>
      </div>

      <figcaption id="rails-walk-caption" className={w.caption}>
        <strong>{translate({id: 'rails.walk.cap.recorded', message: 'Recorded:'})}</strong>{' '}
        {translate({id: 'rails.walk.cap.recordedText', message: 'every tool call, command, question and number in the terminal — from a scripted walk of the rails (no AI involved), on invented sentences in a made-up language, “Our language”.'})}{' '}
        <strong>{translate({id: 'rails.walk.cap.written', message: 'Written by us:'})}</strong>{' '}
        {translate({id: 'rails.walk.cap.writtenText', message: 'what the grandson and the agent say.'})}{' '}
        {translate({id: 'rails.walk.cap.double', message: 'The “model” in this walk is a test double — a stand-in with no real training — so its scores show what the tools report, not what any model can do.'})}
      </figcaption>

      <details className={w.transcript}>
        <summary>
          {translate({id: 'rails.walk.transcript', message: 'Read the whole walk as text — every step as recorded'})} ({steps.length})
        </summary>
        <ol dir="ltr" translate="no">
          {steps.map((e) => (
            <li key={e.i}><span className={w.tWho}>{e.who}</span><pre>{e.text}</pre></li>
          ))}
        </ol>
      </details>
    </figure>
  );
}
