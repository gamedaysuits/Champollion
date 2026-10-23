import React from 'react';
import {useThemeConfig} from '@docusaurus/theme-common';
import Link from '@docusaurus/Link';
import {translate} from '@docusaurus/Translate';
import LinkItem from '@theme/Footer/LinkItem';

import BrandMark from '../../components/BrandMark';
import site from '../../data/rails-demo/site-data.json';

import styles from './styles.module.css';

/**
 * Footer — swizzled. The approved homepage draft's close (v7, founder
 * 2026-10-12): the triad hairline, the mark with the brand line, four link
 * columns (still driven by themeConfig.footer.links, so the config stays the
 * single source of truth) and one legal line. No install one-liners: the site
 * leads with the agent path ("we don't want people getting CLI panic").
 *
 * Always ink (both themes). Tokens: --footer-* in src/css/design-tokens.css.
 */
export default function Footer() {
  const {footer} = useThemeConfig();
  if (!footer) {
    return null;
  }
  const {links = [], copyright} = footer;

  return (
    <footer className={styles.footer} data-theme="dark">
      <div className={styles.wrap}>
        <span className={styles.triad} aria-hidden="true" />
        <div className={styles.grid}>
          <div className={styles.brandCol}>
            <Link to="/" className={styles.brand}>
              <BrandMark size={24} />
              <span>champollion</span>
            </Link>
            <p className={styles.tagline}>
              {translate({id: 'footer.v8.tagline', message: 'Machine translation development and deployment on rails with guardrails.', description: 'footer brand line (the founder’s one phrase)'})}
            </p>
          </div>
          {links.map((column, i) => (
            <div key={i} className={styles.col}>
              {column.title && <h4 className={styles.colTitle}>{column.title}</h4>}
              <ul className={styles.colItems}>
                {(column.items || []).map((item, j) => (
                  <li key={j}>
                    <LinkItem item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Licences, read from the packages themselves (site-data.json is
            generated from each package's manifest). PolyForm Noncommercial
            parts are "source-available", never "open-source". */}
        <div className={styles.legal}>
          <p>
            {translate({
              id: 'footer.v7.legal',
              message: 'Source-available. Free for noncommercial use; commercial licences free for speaker communities on request.',
              description: 'footer legal line, before the list of package licences',
            })}{' '}
            {site.licences.map((x, i) => (
              <React.Fragment key={x.name}>
                {i > 0 && ' · '}
                <span translate="no">{x.name}</span>: {x.license}
                {x.license.startsWith('PolyForm') ? ' (source-available)' : x.license.startsWith('AGPL') ? ' (open source)' : ''}
              </React.Fragment>
            ))}
            {' · '}
            <Link to="/docs/getting-started/who-may-use-this">
              {translate({id: 'footer.v7.whoMay', message: 'Who may use this', description: 'footer link to the licence explainer'})}
            </Link>
          </p>
          {copyright && (
            <div
              className={styles.copyright}
              // Same contract as the stock footer: copyright is
              // config-provided HTML.
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{__html: copyright}}
            />
          )}
        </div>
      </div>
    </footer>
  );
}
