import React from 'react';
import Translate from '@docusaurus/Translate';
import styles from './WipBanner.module.css';

/**
 * The site-wide work-in-progress line (founder, 2026-10-18: "I still want
 * the site behind its gate and to have a WIP banner"). It says what is true
 * whatever the packages' release state: the tools and these pages are still
 * changing, and nothing a model writes is to be relied on without a fluent
 * speaker. Rendered on the server (no script needed), on every page.
 */
export default function WipBanner() {
  return (
    <div className={styles.bar} role="note">
      <strong>
        <Translate id="site.wip.label">Work in progress.</Translate>
      </strong>{' '}
      <Translate id="site.wip.text">
        The tools and these pages are still changing. Nothing a model makes here is ready to rely on until a fluent speaker has checked it.
      </Translate>
    </div>
  );
}
