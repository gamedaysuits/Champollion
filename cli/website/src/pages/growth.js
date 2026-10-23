import React from 'react';
import {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import GrowthRecord from '../components/GrowthRecord';
import '../css/landing-v4.css';

/**
 * /growth — the build record: how people are building the network.
 *
 * A standalone time-series page over the two public sources (the served
 * mesh artifact + the run_cards board). Real data only: an empty board
 * renders the honest empty state, never a mockup. Linked from the homepage
 * hero legend; the component carries all logic (GrowthRecord).
 *
 * Pinned dark like the homepage (the charts are designed on the ink
 * surface; the docs keep the light/dark toggle).
 */
export default function GrowthPage() {
  return (
    <Layout
      title={translate({id: 'page.growth.seoTitle', message: 'The build record — how people are building the network', description: '/growth SEO title'})}
      description={translate({id: 'page.growth.seoDesc', message: "The Champollion network's time series, from real public data: measured language pairs accumulating run by run, colored by connection strength (cchrF++), with every contributor credited. An empty board shows an empty record — the record starts with the first run.", description: '/growth SEO description'})}
    >
      <div data-theme="dark" style={{ background: '#06070b', overflowX: 'clip' }}>
        <main>
          <GrowthRecord />
        </main>
      </div>
    </Layout>
  );
}
