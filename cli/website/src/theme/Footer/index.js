import React from 'react';
import {useThemeConfig} from '@docusaurus/theme-common';
import LinkItem from '@theme/Footer/LinkItem';

import BrandMark from '../../components/BrandMark';

import styles from './styles.module.css';

/**
 * Footer — swizzled (wave 2, "de-Docusaurus the chrome").
 *
 * Replaces the stock link-column footer with a branded close: the stela
 * mark + a large Fraunces wordmark, the triad rule, compact link rows
 * (still driven by themeConfig.footer.links, so the config stays the
 * single source of truth), the two install one-liners, and copyright.
 *
 * Always ink (both themes) — the site's "field notes at night" close.
 * Tokens: --footer-* in src/css/design-tokens.css.
 */
export default function Footer() {
  const {footer} = useThemeConfig();
  if (!footer) {
    return null;
  }
  const {links = [], copyright} = footer;

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.brandRow}>
          <BrandMark size={46} className={styles.mark} />
          <span className={styles.wordmark}>champollion</span>
        </div>
        <p className={styles.tagline}>
          open translation infrastructure for low-resource languages
        </p>
        <hr className={styles.triad} aria-hidden="true" />

        {links.length > 0 && (
          <nav className={styles.linkRows} aria-label="Footer links">
            {links.map((column, i) => (
              <div key={i} className={styles.linkRow}>
                {column.title && (
                  <span className={styles.linkRowTitle}>{column.title}</span>
                )}
                <ul className={styles.linkRowItems}>
                  {(column.items || []).map((item, j) => (
                    <li key={j} className={styles.linkRowItem}>
                      <LinkItem item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}

        <div className={styles.installRow}>
          <span className={styles.installPair}>
            <span className={styles.installLabel}>translate</span>
            <code className={styles.installCode}>npm i -g champollion</code>
          </span>
          <span className={styles.installPair}>
            <span className={styles.installLabel}>benchmark</span>
            <code className={styles.installCode}>
              pipx install mt-eval-harness
            </code>
          </span>
        </div>

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
    </footer>
  );
}
