import React, { useEffect } from 'react';
import Translate, {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { useLocation, useHistory } from '@docusaurus/router';

/* ============================================================================
   /trading-cards → /languages (merged 2026-06-28).

   The "Language Index" and the "Atlas" were the same browse surface; they're
   now ONE page at /languages. This route preserves old deep links (?q=<code>)
   by forwarding the query string. A server-side 301 also lives in vercel.json;
   this client redirect covers SPA navigation + the dev server.
   ========================================================================== */
export default function TradingCardsRedirect() {
  const location = useLocation();
  const history = useHistory();
  const dest = `/languages${location.search}${location.hash}`;

  useEffect(() => {
    history.replace(dest);
  }, [dest, history]);

  return (
    <Layout title={translate({id: 'page.tc.seoTitle', message: 'The Language Atlas', description: 'redirect SEO title'})} description={translate({id: 'page.tc.seoDesc', message: 'Redirecting to the Language Atlas.', description: 'redirect SEO description'})}>
      <main className="container margin-vert--xl" style={{ textAlign: 'center' }}>
        <p>
          <Translate id="page.tc.moved" description="redirect note; {atlas} is a link" values={{atlas: <Link to={dest}><Translate id="page.tc.atlasLink" description="link text">the Language Atlas</Translate></Link>}}>{'The Language Index has moved to {atlas}.'}</Translate>
        </p>
      </main>
    </Layout>
  );
}
