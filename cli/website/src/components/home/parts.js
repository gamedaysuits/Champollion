import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {translate} from '@docusaurus/Translate';
import {addLockPop} from '../../utils/lockPop.mjs';
import h from './home.module.css';

/* The homepage's small interactive parts (v7, 2026-10-12). */

const calm = () => typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => typeof window !== 'undefined'
  && window.matchMedia('(max-width: 720px)').matches;
export const TEAL_RGB = () => (typeof window === 'undefined'
  ? '63, 193, 192'
  : (getComputedStyle(document.querySelector(`.${h.page}`) || document.body).getPropertyValue('--accent-rgb').trim() || '63, 193, 192'));

/** gsap, loaded on first use (bundled; never a CDN, never on the server). */
let gsapPromise = null;
export function loadGsap() {
  if (!gsapPromise) gsapPromise = import('gsap').then((m) => m.gsap || m.default);
  return gsapPromise;
}

/* ── copy: a tick only for a copy that happened ─────────────────────────── */
const CopyIcon = () => (
  <>
    <svg className={h.copyIdle} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
    <svg className={h.copyDone} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
  </>
);

export function CopyBox({text, label, json = false, say = false, children}) {
  const box = useRef(null);
  const btn = useRef(null);
  const code = useRef(null);
  const timer = useRef(null);
  const [live, setLive] = useState('');
  const onCopy = useCallback(async () => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      ok = false;
    }
    if (!ok) {
      // never a tick for a copy that did not happen: select it to copy by hand
      window.getSelection().selectAllChildren(code.current);
      setLive(translate({id: 'home.v7.copy.selected', message: 'Selected — press ⌘C or Ctrl+C to copy'}));
      return;
    }
    setLive(translate({id: 'home.v7.copy.copied', message: 'Copied'}));
    clearTimeout(timer.current);
    const b = box.current;
    b.removeAttribute('data-copied');
    void b.offsetWidth; // restart the gloss
    btn.current.setAttribute('data-done', '');
    b.setAttribute('data-copied', '');
    if (!calm()) {
      loadGsap().then((gsap) => {
        addLockPop(gsap, gsap.timeline(), btn.current.querySelector(`.${h.copyDone}`), 0,
          {rgb: TEAL_RGB(), restGlow: 0, rest: 0, clear: true, noTransition: true, fromRest: true});
      });
    }
    timer.current = setTimeout(() => {
      btn.current?.removeAttribute('data-done');
      box.current?.removeAttribute('data-copied');
      setLive('');
    }, 1400);
  }, [text]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div ref={box} className={[h.cmd, json ? h.json : '', say ? h.sayCmd : ''].join(' ')}>
      <code ref={code} className={say ? h.say : undefined} translate={say ? undefined : 'no'} dir={say ? undefined : 'ltr'}>{children}</code>
      <button ref={btn} className={h.copy} type="button" aria-label={label} onClick={onCopy}><CopyIcon /></button>
      <span className={h.sr} aria-live="polite">{live}</span>
    </div>
  );
}

/* ── tooltips: beside the word on wide screens, one sheet on phones ────── */
const Sheet = createContext(null);

export function TermSheetProvider({children}) {
  const [sheet, setSheet] = useState(null); // {id, text}
  const [open, setOpen] = useState(null); // id of the open inline tooltip
  const close = useCallback(() => {
    setSheet(null);
    setOpen(null);
  }, []);
  useEffect(() => {
    if (!sheet && !open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onScroll = () => { if (sheet) close(); };
    const onDoc = (e) => { if (!e.target.closest(`.${h.term}`)) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDoc);
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDoc);
      window.removeEventListener('scroll', onScroll);
    };
  }, [sheet, open, close]);
  return (
    <Sheet.Provider value={{sheet, setSheet, open, setOpen}}>
      {children}
      {sheet && <div className={h.sheet} role="status">{sheet.text}</div>}
    </Sheet.Provider>
  );
}

export function Term({id, word, tip}) {
  const ctx = useContext(Sheet);
  const isOpen = ctx && ctx.open === id;
  const onClick = (e) => {
    e.preventDefault();
    if (!ctx) return;
    if (narrow()) {
      ctx.setSheet(ctx.sheet && ctx.sheet.id === id ? null : {id, text: tip});
      return;
    }
    ctx.setOpen(isOpen ? null : id);
  };
  return (
    <span className={h.term} data-open={isOpen ? '' : undefined}>
      <button type="button" className={h.termBtn} aria-describedby={`tt-${id}`} onClick={onClick}>{word}</button>
      <span className={h.tt} role="tooltip" id={`tt-${id}`}>{tip}</span>
    </span>
  );
}

/* ── the licence request ─────────────────────────────────────────────────
 * The founder is settling the licence terms (2026-10-12), so the band's words
 * live here, in one place. Without script the button is a plain mailto link;
 * with script it opens a four-field form that writes the email — nothing is
 * sent until the person sends it — and a done panel that, if no mail app
 * opens or the copy fails, shows the request selected to copy by hand. */
export const LICENCE = {
  to: 'info@champollion.dev',
  subject: 'Commercial licence request — speaker community',
};
const licenceHref = () => `mailto:${LICENCE.to}?subject=${encodeURIComponent(LICENCE.subject)}`;

export function LicenceBand({buttonRef}) {
  const dlg = useRef(null);
  const form = useRef(null);
  const copyBtn = useRef(null);
  const textRef = useRef(null);
  const [done, setDone] = useState(false);
  const [request, setRequest] = useState('');
  const [copyState, setCopyState] = useState('idle'); // idle | copied | failed

  const openDialog = (e) => {
    if (!dlg.current || typeof dlg.current.showModal !== 'function') return; // the mailto link stands
    e.preventDefault();
    dlg.current.showModal();
  };
  const onClose = () => {
    setDone(false);
    setCopyState('idle');
    form.current?.reset();
  };
  const onSubmit = (e) => {
    e.preventDefault();
    const f = new FormData(form.current);
    const body = `Name: ${f.get('name')}\nCommunity or organization: ${f.get('community')}\nLanguage(s): ${f.get('language') || ''}\n\nWhat we would use it for:\n${f.get('use') || ''}\n`;
    setRequest(body);
    window.location.href = `${licenceHref()}&body=${encodeURIComponent(body)}`;
    setDone(true);
    setTimeout(() => copyBtn.current?.focus(), 0);
  };
  const full = `To: ${LICENCE.to}\nSubject: ${LICENCE.subject}\n\n${request}`;
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopyState('copied');
    } catch (err) {
      setCopyState('failed');
      setTimeout(() => {
        textRef.current?.focus();
        textRef.current?.select();
      }, 0);
    }
  };
  const onBackdrop = (e) => {
    if (e.target === dlg.current || e.target.closest('[data-close]')) dlg.current.close();
  };
  const X = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  );

  return (
    <>
      <section id="licence" className={`${h.glass} ${h.licence}`} aria-labelledby="lic-h">
        <span className={h.licenceWash} aria-hidden="true" />
        <span className={h.triad} aria-hidden="true" />
        <div>
          <h2 id="lic-h" className={h.licenceTitle}>
            {translate({id: 'home.v7.licence.title', message: 'Commercial licences are free for speaker communities.'})}
          </h2>
          <p>
            {translate({id: 'home.v7.licence.body', message: 'The tools are free for noncommercial use. If your community wants to use them commercially — a language app, a service, a school program — ask, and the licence is free.'})}
          </p>
        </div>
        <a ref={buttonRef} className={`${h.btn} ${h.btnLg} ${h.primary}`} href={licenceHref()} onClick={openDialog}>
          {translate({id: 'home.v7.licence.cta', message: 'Request a licence'})}
        </a>
      </section>

      <dialog ref={dlg} className={h.dialog} aria-labelledby={done ? 'done-h' : 'dlg-h'} aria-describedby={done ? 'done-p' : undefined} onClose={onClose} onClick={onBackdrop}>
        <form ref={form} className={h.dlg} hidden={done} onSubmit={onSubmit}>
          <div className={h.dlgTop}>
            <h2 id="dlg-h" className={h.dlgTitle}>{translate({id: 'home.v7.licence.dlgTitle', message: 'Request a commercial licence'})}</h2>
            <button className={h.x} type="button" data-close aria-label={translate({id: 'home.v7.licence.close', message: 'Close'})}><X /></button>
          </div>
          <p>{translate({id: 'home.v7.licence.dlgBody', message: 'Free for speaker communities. This writes an email to info@champollion.dev for you to send — nothing is sent until you do.'})}</p>
          <div className={h.fieldRow}>
            <label htmlFor="f-name">{translate({id: 'home.v7.licence.fName', message: 'Your name'})} <span className={h.req} aria-hidden="true">*</span></label>
            <input id="f-name" name="name" required autoComplete="name" />
          </div>
          <div className={h.fieldRow}>
            <label htmlFor="f-comm">{translate({id: 'home.v7.licence.fCommunity', message: 'Your community or organization'})} <span className={h.req} aria-hidden="true">*</span></label>
            <input id="f-comm" name="community" required />
          </div>
          <div className={h.fieldRow}>
            <label htmlFor="f-lang">{translate({id: 'home.v7.licence.fLanguage', message: 'Language or languages'})}</label>
            <input id="f-lang" name="language" />
          </div>
          <div className={h.fieldRow}>
            <label htmlFor="f-use">{translate({id: 'home.v7.licence.fUse', message: 'What you would use it for'})}</label>
            <textarea id="f-use" name="use" rows={3} />
          </div>
          <div className={h.row}>
            <button className={`${h.btn} ${h.btnMd} ${h.glassBtn}`} type="button" data-close>{translate({id: 'home.v7.licence.cancel', message: 'Cancel'})}</button>
            <button className={`${h.btn} ${h.btnMd} ${h.primary}`} type="submit">{translate({id: 'home.v7.licence.write', message: 'Write the email'})}</button>
          </div>
        </form>
        <div className={h.dlg} hidden={!done}>
          <div className={h.dlgTop}>
            <h2 id="done-h" className={h.dlgTitle}>{translate({id: 'home.v7.licence.doneTitle', message: 'Your email is ready'})}</h2>
            <button className={h.x} type="button" data-close aria-label={translate({id: 'home.v7.licence.close', message: 'Close'})}><X /></button>
          </div>
          <p id="done-p">
            {translate({id: 'home.v7.licence.doneBody', message: 'Your email app should open with the request filled in. If it didn’t, send it to info@champollion.dev — you can copy it here.'})}
          </p>
          {copyState === 'failed' && (
            <textarea ref={textRef} className={h.fallback} rows={7} readOnly value={full}
              aria-label={translate({id: 'home.v7.licence.textLabel', message: 'The request, to copy'})} />
          )}
          <div className={h.row}>
            <button ref={copyBtn} className={`${h.btn} ${h.btnMd} ${h.glassBtn}`} type="button" onClick={onCopy}>
              {copyState === 'copied'
                ? translate({id: 'home.v7.licence.copied', message: 'Copied'})
                : copyState === 'failed'
                  ? translate({id: 'home.v7.licence.copyFailed', message: 'Copy failed — select the text above'})
                  : translate({id: 'home.v7.licence.copy', message: 'Copy the request'})}
            </button>
            <button className={`${h.btn} ${h.btnMd} ${h.primary}`} type="button" data-close>{translate({id: 'home.v7.licence.done', message: 'Done'})}</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
