import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, {translate} from '@docusaurus/Translate';

// Reuse DonateCard's surface so the two CTAs read as an equal-weight pair:
// DonateCard carries the COMPUTE lane ("run the queue with your API credits"),
// CommunityCard carries the COMMUNITY/SOVEREIGNTY lane ("bring your language,
// register a corpus under your terms"). Same full-bleed ink section, same
// typography — balanced, not one-sided toward the machine half of the hub.
import styles from './DonateCard.module.css';

/**
 * CommunityCard — "Bring your language" CTA.
 *
 * Rendered directly after <DonateCard> on the landing page. Where DonateCard
 * invites spare compute, this invites the other half of the network: the
 * communities and corpus stewards whose languages the map is for. The terms
 * stay theirs — public, non-commercial research-only, or fully private — which
 * is the whole point of sovereignty-aspirant, fetch-from-source registration.
 */
export default function CommunityCard() {
  return (
    <section
      className={clsx('labV4', styles.donateCard)}
      aria-label={translate({
        id: 'community.section.aria',
        message:
          'Bring your language to the network — register a corpus on your own terms, public, research-only, or private',
      })}
    >
      <div className={styles.inner}>
        <h2 className={styles.headline}>
          <Translate id="community.headline">Bring your language</Translate>
        </h2>
        <p className={styles.subCopy}>
          <Translate id="community.subCopy">
            The map is for the communities it names. Register a corpus on your
            own terms — public, research-only, or private — and keep ownership,
            control, access, and possession. We fetch from source; the data
            stays yours.
          </Translate>
        </p>

        <Link
          to="/my-language"
          className="button button--primary button--lg"
        >
          <Translate id="community.cta">Start with your language</Translate>
        </Link>

        <Link to="/docs/network/sovereignty/registering-corpora" className={styles.moreLink}>
          <Translate id="community.moreLink">
            How corpus registration works
          </Translate>
          <span className={styles.moreLinkArrow} aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
