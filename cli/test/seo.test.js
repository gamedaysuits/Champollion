/**
 * SEO generators tests — hreflang, sitemap XML, JSON-LD schema.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLocalizedUrl,
  generateHreflangTags,
  generateAllHreflangTags,
  generateSitemap,
  generateJsonLd,
  escapeXml,
} from '../lib/seo.js';

// -----------------------------------------------------------------
// buildLocalizedUrl
// -----------------------------------------------------------------

describe('buildLocalizedUrl', () => {
  it('builds /:locale/:path URLs (default)', () => {
    const url = buildLocalizedUrl('https://example.com', '/:locale/:path', 'fr', '/about');
    assert.equal(url, 'https://example.com/fr/about');
  });

  it('builds /:locale/:path for root page', () => {
    const url = buildLocalizedUrl('https://example.com', '/:locale/:path', 'fr', '/');
    assert.equal(url, 'https://example.com/fr');
  });

  it('builds /:path/:locale URLs', () => {
    const url = buildLocalizedUrl('https://example.com', '/:path/:locale', 'fr', '/about');
    assert.equal(url, 'https://example.com/about/fr');
  });

  it('builds subdomain URLs', () => {
    const url = buildLocalizedUrl('https://example.com', 'subdomain', 'fr', '/about');
    assert.equal(url, 'https://fr.example.com/about');
  });

  it('strips trailing slashes from baseUrl', () => {
    const url = buildLocalizedUrl('https://example.com/', '/:locale/:path', 'fr', '/about');
    assert.equal(url, 'https://example.com/fr/about');
  });

  it('normalizes pagePath without leading slash', () => {
    const url = buildLocalizedUrl('https://example.com', '/:locale/:path', 'fr', 'about');
    assert.equal(url, 'https://example.com/fr/about');
  });
});

// -----------------------------------------------------------------
// generateHreflangTags
// -----------------------------------------------------------------

describe('generateHreflangTags', () => {
  it('generates correct hreflang tags', () => {
    const tags = generateHreflangTags({
      baseUrl: 'https://example.com',
      urlPattern: '/:locale/:path',
      inputLocale: 'en',
      locales: ['fr', 'de'],
      pagePath: '/',
    });

    assert.ok(tags.includes('hreflang="de"'));
    assert.ok(tags.includes('hreflang="en"'));
    assert.ok(tags.includes('hreflang="fr"'));
    assert.ok(tags.includes('hreflang="x-default"'));
  });

  it('x-default points to input locale', () => {
    const tags = generateHreflangTags({
      baseUrl: 'https://example.com',
      urlPattern: '/:locale/:path',
      inputLocale: 'en',
      locales: ['fr'],
      pagePath: '/',
    });

    // x-default should use the EN url
    const xDefaultLine = tags.split('\n').find(l => l.includes('x-default'));
    assert.ok(xDefaultLine.includes('/en'));
  });

  it('deduplicates input locale in locales array', () => {
    const tags = generateHreflangTags({
      baseUrl: 'https://example.com',
      urlPattern: '/:locale/:path',
      inputLocale: 'en',
      locales: ['en', 'fr'],
      pagePath: '/',
    });

    // Count how many times "en" appears as hreflang (should be 1 + x-default)
    const enCount = (tags.match(/hreflang="en"/g) || []).length;
    assert.equal(enCount, 1);
  });
});

// -----------------------------------------------------------------
// generateAllHreflangTags
// -----------------------------------------------------------------

describe('generateAllHreflangTags', () => {
  it('generates tags for all configured pages', () => {
    const config = {
      inputLocale: 'en',
      languages: ['fr', 'de'],
      seo: {
        baseUrl: 'https://example.com',
        pages: ['/', '/about', '/contact'],
      },
    };
    const output = generateAllHreflangTags(config);
    assert.ok(output.includes('Page: /'));
    assert.ok(output.includes('Page: /about'));
    assert.ok(output.includes('Page: /contact'));
  });

  it('returns fallback when baseUrl is missing', () => {
    const config = { inputLocale: 'en', languages: ['fr'] };
    const output = generateAllHreflangTags(config);
    assert.ok(output.includes('Set "baseUrl"'));
  });

  it('reads locales from pairs config', () => {
    const config = {
      inputLocale: 'en',
      pairs: { 'en:fr': {}, 'en:de': {} },
      seo: { baseUrl: 'https://example.com' },
    };
    const output = generateAllHreflangTags(config);
    assert.ok(output.includes('hreflang="fr"'));
    assert.ok(output.includes('hreflang="de"'));
  });
});

// -----------------------------------------------------------------
// generateSitemap
// -----------------------------------------------------------------

describe('generateSitemap', () => {
  it('generates valid XML sitemap', () => {
    const config = {
      inputLocale: 'en',
      languages: ['fr'],
      seo: {
        baseUrl: 'https://example.com',
        pages: ['/'],
      },
    };
    const xml = generateSitemap(config);

    assert.ok(xml.startsWith('<?xml version="1.0"'));
    assert.ok(xml.includes('<urlset'));
    assert.ok(xml.includes('</urlset>'));
    assert.ok(xml.includes('<loc>'));
    assert.ok(xml.includes('xhtml:link'));
    assert.ok(xml.includes('x-default'));
  });

  it('generates entries for each locale × page combination', () => {
    const config = {
      inputLocale: 'en',
      languages: ['fr', 'de'],
      seo: {
        baseUrl: 'https://example.com',
        pages: ['/', '/about'],
      },
    };
    const xml = generateSitemap(config);

    // 3 locales × 2 pages = 6 <url> blocks
    const urlCount = (xml.match(/<url>/g) || []).length;
    assert.equal(urlCount, 6);
  });

  it('returns fallback when baseUrl is missing', () => {
    const config = { inputLocale: 'en', languages: ['fr'] };
    const xml = generateSitemap(config);
    assert.ok(xml.includes('Set "baseUrl"'));
  });
});

// -----------------------------------------------------------------
// generateJsonLd
// -----------------------------------------------------------------

describe('generateJsonLd', () => {
  it('generates valid JSON-LD script block', () => {
    const config = {
      inputLocale: 'en',
      languages: ['fr', 'de'],
      seo: { baseUrl: 'https://example.com' },
    };
    const jsonLd = generateJsonLd(config);

    assert.ok(jsonLd.includes('<script type="application/ld+json">'));
    assert.ok(jsonLd.includes('"@type": "WebSite"'));
    assert.ok(jsonLd.includes('"inLanguage": "en"'));
    assert.ok(jsonLd.includes('"fr"'));
    assert.ok(jsonLd.includes('"de"'));
  });

  it('returns fallback when baseUrl is missing', () => {
    const config = { inputLocale: 'en' };
    const jsonLd = generateJsonLd(config);
    assert.ok(jsonLd.includes('Set "baseUrl"'));
  });
});

// -----------------------------------------------------------------
// escapeXml
// -----------------------------------------------------------------

describe('escapeXml', () => {
  it('escapes ampersands', () => {
    assert.equal(escapeXml('A & B'), 'A &amp; B');
  });

  it('escapes angle brackets', () => {
    assert.equal(escapeXml('<script>'), '&lt;script&gt;');
  });

  it('escapes quotes', () => {
    assert.equal(escapeXml('say "hello"'), 'say &quot;hello&quot;');
  });

  it('handles clean strings', () => {
    assert.equal(escapeXml('hello world'), 'hello world');
  });
});
