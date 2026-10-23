import React from 'react';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import {translate} from '@docusaurus/Translate';
import {RELEASE} from './release.mjs';
import s from './rails.module.css';

/**
 * Register — a section on two hairlines with a mono kicker: "§02 · YOUR DATA".
 * The numbering is the page's own order (journey order), never a count.
 */
export default function Register({n, kicker, title, id, children, className}) {
  // register the section's id so links to /#<id> pass the build's anchor check
  const broken = useBrokenLinks();
  if (id) broken.collectAnchor(id);
  return (
    <section className={[s.register, className].filter(Boolean).join(' ')} id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className={s.wrap}>
        <div className={s.registerHead}>
          <span className={s.kicker} translate="no">§{n}</span>
          <span className={s.kicker}>{kicker}</span>
        </div>
        {title && <h2 className={s.registerTitle} id={id ? `${id}-title` : undefined}>{title}</h2>}
        {children}
      </div>
    </section>
  );
}

/** A broken-corner card for what we do not know. */
export function Caveat({label, children}) {
  return (
    <div className={s.caveat} role="note">
      {label && <span className={s.caveatLabel}>{label}</span>}
      {children}
    </div>
  );
}

/** A shell command, shown as one: LTR, untranslated, with a prompt. */
export function Cmd({children, block}) {
  if (block) {
    return (
      <pre className={s.cmdBlock} dir="ltr" translate="no">
        {String(children).split('\n').map((line, i) => (
          <React.Fragment key={i}>
            {i > 0 && '\n'}
            {line.startsWith('#') ? line : <><span className={s.prompt} aria-hidden="true">$ </span>{line}</>}
          </React.Fragment>
        ))}
      </pre>
    );
  }
  return <code className={s.cmd} dir="ltr" translate="no">{children}</code>;
}

/**
 * Shown on every rails page while release.json says the rails are not
 * released: the commands described here are not in the packages published
 * today (same version numbers, older code). Renders nothing once released.
 */
export function PreRelease({short}) {
  if (RELEASE.released) return null;
  const list = Object.entries(RELEASE.published).map(([n, v]) => `${n} ${v}`).join(', ');
  if (short) {
    return (
      <p className={s.preReleaseShort} role="note">
        <strong>{translate({id: 'rails.prerelease.shortLabel', message: 'Not released yet:'})}</strong>{' '}
        {translate({id: 'rails.prerelease.short', message: 'the rails arrive with the next release of the tools. The packages on npm and PyPI today do not have them'})}{' '}<span translate="no">({list})</span>.
      </p>
    );
  }
  return (
    <div className={s.preRelease} role="note">
      <strong>{translate({id: 'rails.prerelease.label', message: 'Not released yet.'})}</strong>{' '}
      {translate({id: 'rails.prerelease.body', message: 'The commands on this page come with the next release of the tools. The packages on npm and PyPI today do not have them:'})}{' '}
      <span translate="no">{list}</span>{' '}
      {translate({id: 'rails.prerelease.checked', message: '(checked'})} <span translate="no">{RELEASE.checked}</span>{'). '}
      {translate({id: 'rails.prerelease.tail', message: 'This page is a preview.'})}
    </div>
  );
}
