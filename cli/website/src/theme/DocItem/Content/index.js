import React from 'react';
import Link from '@docusaurus/Link';
import Content from '@theme-original/DocItem/Content';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import {translate} from '@docusaurus/Translate';
import {RELEASE} from '@site/src/components/rails/release.mjs';
import s from './styles.module.css';

/* Wrap (not eject) the doc content: while src/data/rails-demo/release.json
   says the rails are not released, every doc page opens with a plain-words
   notice — the docs describe the next release. On the people's pages it says
   what a family can do today instead of naming packages; on the agents' and
   reference pages it names the versions out today. Renders nothing once
   released. (The rails site pages keep their own PreRelease notice.) */
function DocsPreRelease({people}) {
  if (RELEASE.released) return null;
  if (people) {
    return (
      <div className={s.notice} role="note">
        <p className={s.line}>
          <strong>{translate({id: 'docs.prerelease.label', message: 'Not out yet.', description: 'docs-wide notice while the rails are unreleased'})}</strong>{' '}
          {translate({id: 'docs.prerelease.people', message: 'The tools arrive with the next version. You can start the most important part today, with no computer:'})}{' '}
          <Link to="/docs/before-you-begin">{translate({id: 'docs.prerelease.peopleLink', message: 'before you begin'})}</Link>.
        </p>
      </div>
    );
  }
  const list = Object.entries(RELEASE.published).map(([n, v]) => `${n} ${v}`).join(' · ');
  return (
    <div className={s.notice} role="note">
      <p className={s.line}>
        <strong>{translate({id: 'docs.prerelease.label', message: 'Not out yet.', description: 'docs-wide notice while the rails are unreleased'})}</strong>{' '}
        {translate({id: 'docs.prerelease.body', message: 'The step-by-step tools these pages describe come with the next version. You can read how they will work now.'})}
      </p>
      <p className={s.small}>
        {translate({id: 'docs.prerelease.small', message: 'Out today:'})}{' '}
        <span translate="no" dir="ltr">{list}</span>
      </p>
    </div>
  );
}

export default function ContentWrapper(props) {
  const {metadata} = useDoc();
  return (
    <>
      <DocsPreRelease people={metadata.sidebar === 'peopleSidebar'} />
      <Content {...props} />
    </>
  );
}
