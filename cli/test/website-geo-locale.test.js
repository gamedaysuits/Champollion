/**
 * Geo-IP locale defaulting for champollion.dev — unit tests for the pure
 * routing decision consumed by cli/website/middleware.js.
 *
 * Founder decision 2026-07-18: the site defaults to the locale of the
 * visitor's IP country, NOT their browser Accept-Language — a visitor from
 * the Philippines gets /fil/ even with an English browser. That default is
 * ONE-TIME: any explicit choice afterwards (visiting a locale path, or
 * picking English in the navbar) wins and is honored immediately, decided
 * from the request alone (path + cookie + country) with no dependence on the
 * Referer header. A stored locale never force-redirects an en path back to
 * itself. Only browser NAVIGATIONS (Accept: text/html) are ever redirected —
 * machine fetches (curl/pip/agents) pass through untouched.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  SITE_LOCALES,
  COUNTRY_LOCALE,
  pathLocaleOf,
  decideLocaleRouting,
  localeRedirectTarget,
  localeCookieHeader,
} from '../website/geo-locale.js';

// What every real browser sends on a page navigation.
const BROWSER = { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' };

describe('Geo locale: country map integrity', () => {
  it('every mapped locale is a configured site locale', () => {
    for (const [country, locale] of Object.entries(COUNTRY_LOCALE)) {
      assert.ok(SITE_LOCALES.includes(locale),
        `${country} maps to '${locale}', which is not a site locale`);
    }
  });

  it('maps the Philippines to fil', () => {
    assert.equal(COUNTRY_LOCALE.PH, 'fil');
  });
});

describe('Geo locale: first-visit geo defaulting', () => {
  it('redirects a Philippines visitor with no cookie to /fil/ — browser language plays no part', () => {
    // Note the decision has no Accept-Language input at all: geography only.
    const d = decideLocaleRouting({ ...BROWSER, pathname: '/', country: 'PH' });
    assert.deepEqual(d, { action: 'redirect', locale: 'fil' });
  });

  it('redirects deep paths, preserving the path', () => {
    const d = decideLocaleRouting({ ...BROWSER, pathname: '/docs/intro', country: 'PH' });
    assert.deepEqual(d, { action: 'redirect', locale: 'fil' });
    assert.equal(localeRedirectTarget(d.locale, '/docs/intro', '?a=1'), '/fil/docs/intro?a=1');
  });

  it('root path redirects to the locale root', () => {
    assert.equal(localeRedirectTarget('fil', '/'), '/fil/');
  });

  it('passes through unmapped countries (en default)', () => {
    assert.deepEqual(decideLocaleRouting({ ...BROWSER, pathname: '/', country: 'US' }), { action: 'passthrough' });
    assert.deepEqual(decideLocaleRouting({ ...BROWSER, pathname: '/', country: 'CA' }), { action: 'passthrough' });
  });

  it('passes through when no country header is present', () => {
    assert.deepEqual(decideLocaleRouting({ ...BROWSER, pathname: '/' }), { action: 'passthrough' });
  });

  it('is case-insensitive on the country code', () => {
    assert.deepEqual(decideLocaleRouting({ ...BROWSER, pathname: '/', country: 'ph' }),
      { action: 'redirect', locale: 'fil' });
  });
});

describe('Geo locale: machine fetches are never touched', () => {
  it('curl-style Accept */* passes through even from a mapped country', () => {
    // Regression guard: `curl champollion.dev/run_queue | bash` from a PH IP
    // must receive the installer, not a 302 to /fil/run_queue.
    for (const p of ['/run_queue', '/', '/docs/intro']) {
      assert.deepEqual(decideLocaleRouting({ pathname: p, country: 'PH', accept: '*/*' }),
        { action: 'passthrough' }, p);
    }
  });

  it('absent Accept header passes through', () => {
    assert.deepEqual(decideLocaleRouting({ pathname: '/', country: 'PH' }),
      { action: 'passthrough' });
    assert.deepEqual(decideLocaleRouting({ pathname: '/', country: 'PH', accept: null }),
      { action: 'passthrough' });
  });

  it('JSON-accepting clients pass through', () => {
    assert.deepEqual(decideLocaleRouting({ pathname: '/docs/intro', country: 'PH', accept: 'application/json' }),
      { action: 'passthrough' });
  });

  it('machine fetches are not remembered either (no cookie churn)', () => {
    assert.deepEqual(decideLocaleRouting({ pathname: '/fil/docs/intro', accept: '*/*' }),
      { action: 'passthrough' });
  });
});

describe('Geo locale: explicit choice beats geography', () => {
  it('remembers a locale the visitor navigates to directly', () => {
    assert.deepEqual(decideLocaleRouting({ ...BROWSER, pathname: '/fil/docs/intro', country: 'US' }),
      { action: 'remember', locale: 'fil' });
    // Cookie already matches — nothing to do.
    assert.deepEqual(decideLocaleRouting({ ...BROWSER, pathname: '/fil/docs/intro', cookieLocale: 'fil' }),
      { action: 'passthrough' });
  });

  it('geography is a ONE-TIME default: a stored locale never forces an en path back to itself', () => {
    // The bug this fixes: a PH visitor defaulted to /fil/ was force-redirected
    // /  →  /fil/ on every visit, so English was unreachable. Now reaching any
    // en path with a non-en cookie is honored as a manual choice and records en.
    assert.deepEqual(decideLocaleRouting({ ...BROWSER, pathname: '/docs/intro', cookieLocale: 'fil', country: 'US' }),
      { action: 'remember', locale: 'en' });
    assert.deepEqual(decideLocaleRouting({ ...BROWSER, pathname: '/', cookieLocale: 'fil', country: 'PH' }),
      { action: 'remember', locale: 'en' });
  });

  it('switching to English is honored with NO dependence on the Referer header', () => {
    // Same result whether or not a Referer path reaches the edge — the decision
    // reads only path + cookie + country, so referrer-policy stripping (the old
    // trap for PH/Arc visitors) can no longer strand anyone on /fil/.
    const d = decideLocaleRouting({
      ...BROWSER, pathname: '/docs/intro', cookieLocale: 'fil', country: 'PH',
    });
    assert.deepEqual(d, { action: 'remember', locale: 'en' });
  });

  it('a remembered en choice stops geography for good', () => {
    assert.deepEqual(decideLocaleRouting({ ...BROWSER, pathname: '/', cookieLocale: 'en', country: 'PH' }),
      { action: 'passthrough' });
  });

  it('ignores an unknown cookie locale and falls back to geography', () => {
    assert.deepEqual(decideLocaleRouting({ ...BROWSER, pathname: '/', cookieLocale: 'tlh', country: 'PH' }),
      { action: 'redirect', locale: 'fil' });
  });
});

describe('Geo locale: scope guards', () => {
  it('never redirects file requests (assets, machine endpoints)', () => {
    for (const p of ['/queue.json', '/img/logo.png', '/sitemap.xml', '/assets/css/styles.css']) {
      assert.deepEqual(decideLocaleRouting({ ...BROWSER, pathname: p, country: 'PH' }),
        { action: 'passthrough' }, p);
    }
  });

  it('never redirects non-GET requests', () => {
    assert.deepEqual(decideLocaleRouting({ ...BROWSER, pathname: '/', method: 'POST', country: 'PH' }),
      { action: 'passthrough' });
  });

  it('locale prefix matching has no bare-prefix false positives', () => {
    assert.equal(pathLocaleOf('/free-tools'), null);
    assert.equal(pathLocaleOf('/pta'), null);
    assert.equal(pathLocaleOf('/fil'), 'fil');
    assert.equal(pathLocaleOf('/fil/'), 'fil');
    assert.equal(pathLocaleOf('/'), null);
  });

  it('locale paths never redirect (no loop is possible)', () => {
    for (const locale of SITE_LOCALES) {
      const d = decideLocaleRouting({ ...BROWSER, pathname: `/${locale}/docs/x`, country: 'PH', cookieLocale: locale });
      assert.equal(d.action, 'passthrough', locale);
    }
  });
});

describe('Geo locale: cookie header', () => {
  it('persists for a year, site-wide, SameSite=Lax', () => {
    const h = localeCookieHeader('fil');
    assert.ok(h.startsWith('champollion_locale=fil;'));
    assert.ok(h.includes('Max-Age=31536000'));
    assert.ok(h.includes('Path=/'));
    assert.ok(h.includes('SameSite=Lax'));
  });
});
