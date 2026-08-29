/**
 * Middleware behavior for champollion.dev — machine endpoints and, since
 * launch (2026-08-28, pre-launch gate deleted), the human pages too.
 *
 * Pre-launch these tests guarded the gate's exemption list (founder call
 * 2026-08-16: serve the real search-indexing policy while the gate was up,
 * every gated page answering `x-robots-tag: noindex, nofollow`). The gate is
 * gone now, but the exemption list SURVIVES as the machine-endpoint fast
 * path, and the trap it guards against survives with it: a regression that
 * routes `/robots.txt` or a locale sitemap through page logic hands a
 * crawler the wrong content type. Policy: docs/SEARCH_INDEXING_POLICY.md.
 *
 * The launch flip is asserted below too: human pages must NOT answer the
 * coming-soon page or a noindex header any more.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import middleware from '../website/middleware.js';
import { SITE_LOCALES } from '../website/geo-locale.js';

const SITE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'website',
);

/** Run one request through the middleware as an anonymous crawler would. */
async function crawl(pathname) {
  const res = await middleware(
    new Request(`https://champollion.dev${pathname}`, {
      headers: { accept: 'text/html' },
    }),
  );
  const body = await res.clone().text().catch(() => '');
  return {
    // Vercel's next() marks "serve the static asset behind me".
    passthrough: res.headers.has('x-middleware-next'),
    // id="gate" is the key-entry form's DOM id — the stable marker across
    // gate-copy rewrites AND localization (the visible labels are translated
    // per-locale since 2026-08-28, so no prose string is safe to match).
    gatePage: body.includes('id="gate"'),
    xRobots: res.headers.get('x-robots-tag'),
  };
}

describe('champollion.dev gate exemptions', () => {
  it('serves the real robots.txt, never the gate page', async () => {
    const r = await crawl('/robots.txt');
    assert.equal(r.passthrough, true, '/robots.txt must pass through to static/');
    assert.equal(r.gatePage, false, '/robots.txt must not be the coming-soon HTML');
  });

  it('the served robots.txt is the launch policy, not a Disallow-all', () => {
    const txt = fs.readFileSync(path.join(SITE_DIR, 'static', 'robots.txt'), 'utf8');
    assert.match(txt, /^\s*Allow: \/\s*$/m, 'the site must be crawlable');
    assert.doesNotMatch(txt, /^\s*Disallow: \/\s*$/m, 'a bare "Disallow: /" locks the site out of search');
    // The bulk machine artifacts stay out of crawlers' hands.
    for (const p of [
      '/data/',
      '/queue.json',
      '/registry.json',
      '/mesh.json',
      '/llms-full.txt',
      '/run_queue',
    ]) {
      assert.ok(
        txt.includes(`Disallow: ${p}`),
        `${p} is bulk data and must be Disallow-ed`,
      );
    }
    // /llms.txt exists FOR agents — it is deliberately crawlable.
    assert.doesNotMatch(txt, /^Disallow: \/llms\.txt\s*$/m);
  });

  it('every sitemap robots.txt names is reachable, not gated', async () => {
    const txt = fs.readFileSync(path.join(SITE_DIR, 'static', 'robots.txt'), 'utf8');
    const declared = [...txt.matchAll(/^Sitemap:\s*(\S+)$/gm)].map((m) =>
      new URL(m[1]).pathname,
    );
    assert.equal(
      declared.length,
      SITE_LOCALES.length + 1,
      'robots.txt must name the en sitemap plus one per locale',
    );
    for (const p of declared) {
      const r = await crawl(p);
      assert.equal(r.passthrough, true, `${p} is named in robots.txt but is gated`);
      assert.equal(r.gatePage, false, `${p} would hand a crawler HTML labelled as XML`);
    }
  });

  it('keeps the machine endpoints installed tooling fetches', async () => {
    for (const p of [
      '/queue.json',
      '/queue-preview.json',
      '/registry.json',
      '/mesh.json',
      '/llms.txt',
      '/llms-full.txt',
      '/run_queue',
    ]) {
      const r = await crawl(p);
      assert.equal(r.passthrough, true, `${p} must not be gated — installed tooling fetches it`);
    }
  });

  it('still gates the human pages through beta, and marks them noindex', async () => {
    // Founder ruling 2026-08-28: the sovereignty gate STAYS through beta
    // (it was briefly deleted on a misread of "beta is live"); the gate page
    // now says "Now in beta" and carries the install lines.
    for (const p of ['/', '/docs/intro', '/languages', '/fr/docs/intro']) {
      const r = await crawl(p);
      assert.equal(r.gatePage, true, `${p} must still be behind the beta gate`);
      assert.equal(
        r.xRobots,
        'noindex, nofollow',
        `${p} is crawlable now, so it MUST say noindex until the public open`,
      );
    }
  });
});
