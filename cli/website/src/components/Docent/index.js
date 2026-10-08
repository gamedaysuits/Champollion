import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Translate, {translate} from '@docusaurus/Translate';
import {
  buildFlagPayload,
  FLAG_KIND,
  FLAG_REQUEST_EVENT,
  askDocent,
  isRunCardId,
  submitTicket,
} from '@site/src/utils/docentClient';
import styles from './styles.module.css';

const MAX_CLIENT_TURNS = 12;

// The ticket-kind vocabulary. THREE-WAY SSOT: this list, `TICKET_KINDS` in the
// edge function (mt-eval-arena/supabase/functions/submit-ticket/lib.ts), and
// the `tickets_kind_check` CHECK in migration 074. Held together by
// arena/tests/test_ticket_kinds_parity.py, which reads all three.
//
// `subjectRequired` marks a kind that cannot be filed on its own: `flag` names
// a specific run card, so it is offered ONLY when a run card is in context
// (a leaderboard row asked for the form via FLAG_REQUEST_EVENT). It is not in
// the general picker, because a flag with no subject is not a flag.
const TICKET_KINDS = [
  {value: 'question', labelId: 'docent.kind.question', label: 'Question'},
  {value: 'correction', labelId: 'docent.kind.correction', label: 'Correction'},
  {value: 'objection', labelId: 'docent.kind.objection', label: 'Objection'},
  {value: 'takedown', labelId: 'docent.kind.takedown', label: 'Takedown request'},
  {value: FLAG_KIND, labelId: 'docent.kind.flag', label: 'Flag this result',
   subjectRequired: true},
  {value: 'other', labelId: 'docent.kind.other', label: 'Something else'},
];

export default function Docent() {
  const {i18n} = useDocusaurusContext();
  const locale = i18n?.currentLocale || 'en';
  const rtl = locale === 'ar';

  const [open, setOpen] = useState(false);
  const [view, setView] = useState('chat'); // 'chat' | 'ticket'
  const [register, setRegister] = useState('warm');

  // chat state
  const [messages, setMessages] = useState([]); // {role, content, sources?, mode?, note?}
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  // ticket state
  const [tKind, setTKind] = useState('question');
  const [tMessage, setTMessage] = useState('');
  const [tEmail, setTEmail] = useState('');
  const [tStatus, setTStatus] = useState(null); // {ok, text}
  const [tSending, setTSending] = useState(false);
  // The run card a flag is about: {runCardId, label}. Null unless a run-card
  // view asked for the flag form — there is no way to reach `flag` otherwise.
  const [flagSubject, setFlagSubject] = useState(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, view]);

  // A run-card view (today: the expanded leaderboard row) asks for the flag
  // form by dispatching FLAG_REQUEST_EVENT with the card's id. The docent is
  // mounted once at the app root, so an event is the minimal seam.
  useEffect(() => {
    function onFlagRequest(e) {
      const runCardId = e?.detail?.runCardId;
      if (!isRunCardId(runCardId)) {
        // Never open a form that cannot be submitted.
        console.error('[docent] flag request without a run card id', e?.detail);
        return;
      }
      setFlagSubject({runCardId, label: e.detail.label || ''});
      setTKind(FLAG_KIND);
      setTStatus(null);
      setView('ticket');
      setOpen(true);
    }
    window.addEventListener(FLAG_REQUEST_EVENT, onFlagRequest);
    return () => window.removeEventListener(FLAG_REQUEST_EVENT, onFlagRequest);
  }, []);

  // Changing the kind away from `flag` drops the subject: a correction about a
  // page is not a flag against a card, and the two must never be conflated.
  const onKindChange = useCallback((value) => {
    setTKind(value);
    if (value !== FLAG_KIND) setFlagSubject(null);
  }, []);

  const kindOptions = TICKET_KINDS.filter(
    (k) => !k.subjectRequired || flagSubject,
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-MAX_CLIENT_TURNS)
      .map((m) => ({role: m.role, content: m.content}));
    setMessages((m) => [...m, {role: 'user', content: text}]);
    setInput('');
    setSending(true);
    try {
      const res = await askDocent({message: text, history, locale, register});
      if (res.ok) {
        setMessages((m) => [
          ...m,
          {role: 'assistant', content: res.answer || '', sources: res.sources || [], mode: res.mode},
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {role: 'assistant', content: res.error || 'Something went wrong.', note: 'error'},
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {role: 'assistant', content: 'Network error — please try again.', note: 'error'},
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, locale, register]);

  const onSubmitTicket = useCallback(async (e) => {
    e.preventDefault();
    if (tSending) return;
    const msg = tMessage.trim();
    if (!msg) {
      setTStatus({ok: false, text: translate({id: 'docent.ticket.needMessage', message: 'Please enter a message.'})});
      return;
    }
    // A flag with no subject must never be sent: fail loudly here rather than
    // posting a body the edge function will refuse.
    if (tKind === FLAG_KIND && !isRunCardId(flagSubject?.runCardId)) {
      setTStatus({ok: false, text: translate({
        id: 'docent.ticket.flagNeedsCard',
        message: 'A flag has to name a result. Open it from that row on the leaderboard.',
      })});
      return;
    }
    setTSending(true);
    setTStatus(null);
    const page_url = typeof window !== 'undefined' ? window.location.href : undefined;
    const email = tEmail.trim() || undefined;
    const payload = tKind === FLAG_KIND
      ? buildFlagPayload({
        runCardId: flagSubject.runCardId,
        message: msg,
        contactEmail: email,
        locale,
        pageUrl: page_url,
      })
      : {
        kind: tKind,
        message: msg,
        contact_email: email,
        locale,
        page_url,
      };
    const res = await submitTicket(payload);
    setTSending(false);
    if (res.ok) {
      setTStatus({ok: true, text: res.message || translate({id: 'docent.ticket.sent', message: 'Thank you — your message has been recorded.'})});
      setTMessage('');
      setTEmail('');
    } else {
      setTStatus({ok: false, text: res.error || translate({id: 'docent.ticket.failed', message: 'Could not send — you can also email info@champollion.dev.'})});
    }
  }, [tKind, tMessage, tEmail, tSending, locale, flagSubject]);

  // A takedown or objection must never dead-end. Whatever the backend does —
  // not deployed, rate-limited, 503, offline — the visitor keeps a working
  // route, pre-filled with what they already typed so they need not retype it.
  // Founder direction 2026-07-20: "people should be able to provide tickets …
  // like takedown requests, and I should get those at info@champollion.dev."
  const mailtoHref = useMemo(() => {
    const subject = `[Champollion] ${tKind} — via the site guide`;
    const page = typeof window !== 'undefined' ? window.location.href : '';
    const body = [
      tMessage,
      '',
      flagSubject && `Run card: ${flagSubject.runCardId}`,
      page && `Page: ${page}`,
      `Locale: ${locale}`,
    ].filter(Boolean).join('\n');
    return `mailto:info@champollion.dev?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [tKind, tMessage, locale, flagSubject]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={styles.docent} dir={rtl ? 'rtl' : 'ltr'} data-rtl={rtl ? 'true' : 'false'}>
      {!open && (
        <button
          type="button"
          className={styles.launcher}
          onClick={() => setOpen(true)}
          aria-label={translate({id: 'docent.open', message: 'Open the site guide'})}
        >
          <span className={styles.launcherIcon} aria-hidden="true">☺</span>
          <span className={styles.launcherText}>
            <Translate id="docent.launcher">Ask the guide</Translate>
          </span>
        </button>
      )}

      {open && (
        <div className={styles.panel} role="dialog" aria-label={translate({id: 'docent.title', message: 'Champollion site guide'})}>
          <header className={styles.header}>
            <div className={styles.headerTitles}>
              <strong className={styles.title}>
                <Translate id="docent.title">Champollion site guide</Translate>
              </strong>
              <span className={styles.experimental}>
                <Translate id="docent.experimental">experimental · grounded in our public docs</Translate>
              </span>
            </div>
            <div className={styles.headerControls}>
              <label className={styles.registerToggle} title={translate({id: 'docent.register.hint', message: 'Conversation tone'})}>
                <select
                  value={register}
                  onChange={(e) => setRegister(e.target.value)}
                  aria-label={translate({id: 'docent.register.aria', message: 'Conversation tone'})}
                >
                  <option value="warm">{translate({id: 'docent.register.warm', message: 'Friendly'})}</option>
                  <option value="formal">{translate({id: 'docent.register.formal', message: 'Formal'})}</option>
                </select>
              </label>
              <button
                type="button"
                className={styles.close}
                onClick={() => setOpen(false)}
                aria-label={translate({id: 'docent.close', message: 'Close'})}
              >
                ×
              </button>
            </div>
          </header>

          <nav className={styles.tabs}>
            <button
              type="button"
              className={view === 'chat' ? styles.tabActive : styles.tab}
              onClick={() => setView('chat')}
            >
              <Translate id="docent.tab.chat">Ask</Translate>
            </button>
            <button
              type="button"
              className={view === 'ticket' ? styles.tabActive : styles.tab}
              onClick={() => setView('ticket')}
            >
              <Translate id="docent.tab.ticket">Send a message</Translate>
            </button>
          </nav>

          {view === 'chat' && (
            <>
              <div className={styles.messages} ref={listRef}>
                {messages.length === 0 && (
                  <div className={styles.intro}>
                    <p>
                      <Translate id="docent.intro">
                        Hi! I'm the site guide. I can explain what Champollion is, how the
                        Network works, and how you can get involved — grounded in our public
                        docs. I can't write code or translate for you, but I can point you to
                        exactly the right page. What would you like to know?
                      </Translate>
                    </p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={m.role === 'user' ? styles.userMsg : styles.botMsg}
                    data-note={m.note || undefined}
                  >
                    <div className={styles.msgText}>{m.content}</div>
                    {m.mode === 'degraded' && (
                      <div className={styles.modeNote}>
                        <Translate id="docent.degraded">The live guide is resting; here are the most relevant pages.</Translate>
                      </div>
                    )}
                    {Array.isArray(m.sources) && m.sources.length > 0 && (
                      <ul className={styles.sources}>
                        {m.sources.map((s, j) => (
                          <li key={j}>
                            <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                {sending && (
                  <div className={styles.botMsg}>
                    <div className={styles.typing} aria-live="polite">…</div>
                  </div>
                )}
              </div>
              <div className={styles.composer}>
                <textarea
                  className={styles.input}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={2}
                  placeholder={translate({id: 'docent.placeholder', message: 'Ask about the project…'})}
                  aria-label={translate({id: 'docent.inputAria', message: 'Your question'})}
                />
                <button type="button" className={styles.sendBtn} onClick={send} disabled={sending || !input.trim()}>
                  <Translate id="docent.send">Send</Translate>
                </button>
              </div>
            </>
          )}

          {view === 'ticket' && (
            <form className={styles.ticketForm} onSubmit={onSubmitTicket}>
              <p className={styles.ticketIntro}>
                <Translate id="docent.ticket.intro">
                  Raise an objection, request a correction or takedown, or ask something I
                  couldn't answer. This reaches the team at info@champollion.dev. Good
                  objections are genuinely welcome.
                </Translate>
              </p>
              <label className={styles.field}>
                <span><Translate id="docent.ticket.kind">Type</Translate></span>
                <select value={tKind} onChange={(e) => onKindChange(e.target.value)}>
                  {kindOptions.map((k) => (
                    <option key={k.value} value={k.value}>
                      {translate({id: k.labelId, message: k.label})}
                    </option>
                  ))}
                </select>
              </label>
              {tKind === FLAG_KIND && flagSubject && (
                <p className={styles.ticketIntro}>
                  <Translate id="docent.ticket.flagSubject">
                    You are flagging the result
                  </Translate>{' '}
                  <code>{flagSubject.label || flagSubject.runCardId}</code>
                  {' — '}
                  <Translate id="docent.ticket.flagPrivate">
                    say what is wrong with it and how you know. Flags are private
                    messages to the maintainers: no count of them is ever shown on
                    the board. If a flag is upheld, the only public change is that
                    result's trust becoming "disqualified", and the cause is added
                    to the submission rules by a dated edit first.
                  </Translate>
                </p>
              )}
              <label className={styles.field}>
                <span><Translate id="docent.ticket.message">Message</Translate></span>
                <textarea
                  value={tMessage}
                  onChange={(e) => setTMessage(e.target.value)}
                  rows={4}
                  maxLength={8000}
                  required
                />
              </label>
              <label className={styles.field}>
                <span><Translate id="docent.ticket.email">Email (optional — leave blank to stay anonymous)</Translate></span>
                <input type="email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} maxLength={320} />
              </label>
              <button type="submit" className={styles.sendBtn} disabled={tSending}>
                {tSending
                  ? translate({id: 'docent.ticket.sending', message: 'Sending…'})
                  : translate({id: 'docent.ticket.submit', message: 'Send message'})}
              </button>
              {tStatus && (
                <div className={tStatus.ok ? styles.ticketOk : styles.ticketErr} role="status">
                  <div>{tStatus.text}</div>
                  {!tStatus.ok && (
                    <a className={styles.mailtoFallback} href={mailtoHref}>
                      <Translate id="docent.ticket.mailtoFallback">
                        Send it by email instead — nothing you typed is lost
                      </Translate>
                    </a>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
