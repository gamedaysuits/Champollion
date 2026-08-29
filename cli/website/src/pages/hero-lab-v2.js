import React, {useState} from 'react';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import GraphHero from '../components/GraphHero';
import EndonymChannel from '../components/EndonymChannel';
import '../css/landing-v4.css';
import styles from './hero-lab-v2.module.css';

/**
 * /hero-lab-v2 — THE LIVING INDEX & THE SEAM (landing v4, lab stage).
 *
 * Design verdict: LIVE GRAPH hero (GraphHero canvas), not a
 * video. This lab composes the v4 concept for art review BEFORE any homepage
 * swap (the standing gate). Unlinked, noindex.
 *
 *   Phase A (here): the endonym CHANNEL — a slow left-rail conveyor of the
 *     whole catalog in each language's own name with speaker counts, every
 *     row linking to its card — overlaid on the live Translation Network.
 *   Phase B (next): the zipper scroll below the hero (stela slider stitching
 *     real language pairs that light electric-blue; the NLD→ENG→SPA→QUE chain).
 *   Phase C: funnel/bento re-skin in the v4 palette.
 *
 * Lab page for hero composition experiments.
 */

// Lab-only: judge the electric accent on screen against the live graph.
const ELECTRICS = [
  {label: 'electric #4DD8FF', v: '#4dd8ff'},
  {label: 'icier #7BE6FF', v: '#7be6ff'},
  {label: 'harder #2EC9FF', v: '#2ec9ff'},
];

export default function HeroLabV2() {
  const [showChannel, setShowChannel] = useState(true);
  const [electric, setElectric] = useState(0);

  return (
    <Layout
      title="The Living Index — lab v4"
      description="Lab stage for the v4 landing: endonym channel over the live Translation Network, with the zipper seam."
      noFooter
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main
        className={`labV4 ${styles.main}`}
        style={{'--electric': ELECTRICS[electric].v}}
      >
        {/* ───────────────── S0 — The Living Index (hero) ───────────────── */}
        <section className={`${styles.hero} sectionInk`}>
          {/* Background layer: the live Translation Network (current pick). */}
          <div className={styles.heroGraph}>
            <GraphHero
              eyebrow="THE CHAMPOLLION PROJECT"
              title="Every language, into every language."
              subline="Most of this map is still dark. Help us light it."
            />
          </div>

          {/* Left rail: the endonym channel, floating over the network. */}
          {showChannel && (
            <div className={styles.rail}>
              <div className={styles.railScrim} aria-hidden="true" />
              <div className={styles.railInner}>
                <EndonymChannel />
              </div>
            </div>
          )}
        </section>

        {/* ──────────────── S1 — The Seam (zipper) placeholder ──────────── */}
        <section className={`${styles.seamStub} sectionBlue`}>
          <hr className="hairline" />
          <p className={styles.stubKicker}>Phase B — coming next iteration</p>
          <h2 className={styles.stubTitle}>The Seam</h2>
          <p className={styles.stubBody}>
            The zipper scroll stitches real language pairs together — the stela
            mark as the slider, pairs lighting electric-blue as they join the
            system, closing on the real chain{' '}
            <strong>Nederlands → English → Español → Runasimi</strong> with
            published composite scores. (Built in Phase B.)
          </p>
          <hr className="hairline" />
        </section>

        {/* Lab-only chrome: composition toggles for the on-screen review. */}
        <div className={styles.labBar} role="group" aria-label="Lab controls">
          <span className={styles.labBarLabel}>LAB</span>
          <button
            type="button"
            className={styles.labBtn}
            onClick={() => setShowChannel((s) => !s)}
          >
            {showChannel ? 'Hide' : 'Show'} channel
          </button>
          <span className={styles.labSep} />
          {ELECTRICS.map((e, i) => (
            <button
              key={e.v}
              type="button"
              className={i === electric ? styles.labBtnActive : styles.labBtn}
              onClick={() => setElectric(i)}
              title={e.label}
            >
              <span className={styles.swatch} style={{background: e.v}} />
              {e.label}
            </button>
          ))}
        </div>
      </main>
    </Layout>
  );
}
