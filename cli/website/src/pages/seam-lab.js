import React from 'react';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import ZipperSeam from '../components/ZipperSeam';

/**
 * /seam-lab — the original ZipperSeam in isolation for reviewing the quality
 * colours + the zipper→network morph. Unlinked, noindex. Scroll to drive it;
 * window.__SEAM_TL.pause().progress(x) steps beats for inspection.
 */
export default function SeamLab() {
  return (
    <Layout title="Seam lab" description="ZipperSeam in isolation." noFooter>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div data-theme="dark" style={{background: '#06070b'}}>
        <ZipperSeam />
        <div style={{height: '60vh'}} />
      </div>
    </Layout>
  );
}
