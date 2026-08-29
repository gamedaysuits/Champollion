import React, {useState} from 'react';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import GraphHero from '../components/GraphHero';
import styles from './graph-lab.module.css';

/**
 * /graph-lab — THE TRANSLATION NETWORK, lab stage (unlinked route).
 *
 * Phases 1–3 of the revised hero concept (plan "The Whole
 * Graph", Track 1): the packet-transfer network + Rosetta inscription
 * register + copy overlay + LIVE counter, staged here for the
 * art-direction review that gates homepage integration (phase 4).
 * Not linked from any nav/footer; noindex.
 *
 * The three sub-line candidates (Track 2: openly aspirational, asks
 * for help, ties lit-vs-dark to the mission) are switchable on screen
 * via the lab-only picker so maintainers can judge them in place.
 */

const SUBLINES = [
  'Most of this map is still dark. Help us light it.',
  'Every benchmark someone runs lights another language. Run one.',
  "We're building open translation infrastructure for all of them — and we can't do it alone.",
];

export default function GraphLab() {
  const [sub, setSub] = useState(0);
  return (
    <Layout
      title="The Translation Network — lab"
      description="Lab stage for the Translation Network hero."
      noFooter
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.labMain}>
        <GraphHero subline={SUBLINES[sub]} />
        {/* Lab-only chrome: sub-line picker for the on-screen review. */}
        <div className={styles.labBar} role="group" aria-label="Sub-line candidates (lab only)">
          <span className={styles.labBarLabel}>SUB-LINE</span>
          {SUBLINES.map((s, i) => (
            <button
              key={i}
              type="button"
              className={i === sub ? styles.labBtnActive : styles.labBtn}
              onClick={() => setSub(i)}
              title={s}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </main>
    </Layout>
  );
}
