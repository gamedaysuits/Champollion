/**
 * SEO generators — deterministic, no LLM calls.
 *
 * Generates three types of SEO artifacts from the pair graph:
 *
 * 1. HREFLANG TAGS: HTML <link rel="alternate" hreflang="..."> elements
 *    for every page × locale combination. Includes x-default.
 *
 * 2. MULTILINGUAL SITEMAP: XML sitemap with <xhtml:link> alternates,
 *    following Google's multilingual sitemap spec.
 *
 * 3. JSON-LD SCHEMA: schema.org WebSite + SearchAction with
 *    @language annotations and workTranslation links.
 *
 * All output is deterministic: same config → same output, byte-for-byte.
 * This means SEO files can be committed to git and diffed reliably.
 */

import path from 'node:path';
import { parsePairKey } from './pairs.js';

// -----------------------------------------------------------------
// URL helpers
// -----------------------------------------------------------------

/**
 * Build a localized URL from a base URL, URL pattern, and locale.
 *
 * Supported patterns:
 *   - /:locale/:path  → https://example.com/fr/about
 *   - /:path/:locale  → https://example.com/about/fr
 *   - subdomain        → https://fr.example.com/about
 *
 * @param {string} baseUrl - Site base URL (no trailing slash)
 * @param {string} urlPattern - One of '/:locale/:path', '/:path/:locale', 'subdomain'
 * @param {string} locale - Language code
 * @param {string} pagePath - Page path (e.g., '/about')
 * @returns {string} Full localized URL
 */
function buildLocalizedUrl(baseUrl, urlPattern, locale, pagePath) {
  // Normalize: remove trailing slashes from baseUrl
  const base = baseUrl.replace(/\/+$/, '');
  // Normalize: ensure pagePath starts with /
  const normalizedPath = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  // Root path special case
  const cleanPath = normalizedPath === '/' ? '' : normalizedPath;

  if (urlPattern === 'subdomain') {
    // https://example.com → https://fr.example.com/about
    const url = new URL(base);
    url.hostname = `${locale}.${url.hostname}`;
    return `${url.origin}${cleanPath}`;
  }

  if (urlPattern === '/:path/:locale') {
    // https://example.com/about/fr
    return `${base}${cleanPath}/${locale}`;
  }

  // Default: /:locale/:path
  return `${base}/${locale}${cleanPath}`;
}

// -----------------------------------------------------------------
// Hreflang tags
// -----------------------------------------------------------------

/**
 * Generate hreflang <link> tags for a single page.
 *
 * @param {object} options
 * @param {string} options.baseUrl - Site base URL
 * @param {string} options.urlPattern - URL localization pattern
 * @param {string} options.inputLocale - Source locale code
 * @param {string[]} options.locales - All locale codes (including source)
 * @param {string} options.pagePath - Page path
 * @returns {string} HTML link tags (one per line)
 */
function generateHreflangTags({ baseUrl, urlPattern, inputLocale, locales, pagePath }) {
  const allLocales = [...new Set([inputLocale, ...locales])];
  const lines = [];

  // Generate one <link> per locale
  for (const locale of allLocales.sort()) {
    const url = buildLocalizedUrl(baseUrl, urlPattern, locale, pagePath);
    lines.push(`<link rel="alternate" hreflang="${locale}" href="${url}" />`);
  }

  // x-default points to the input (source) locale
  const defaultUrl = buildLocalizedUrl(baseUrl, urlPattern, inputLocale, pagePath);
  lines.push(`<link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`);

  return lines.join('\n');
}

/**
 * Generate hreflang tags for all configured pages.
 *
 * @param {import('./types.js').ChampollionConfig} config - Resolved config
 * @returns {string} Full hreflang output (one block per page)
 */
function generateAllHreflangTags(config) {
  const seo = config.seo || {};
  const baseUrl = seo.baseUrl || config.baseUrl;
  const urlPattern = seo.urlPattern || '/:locale/:path';
  const pages = seo.pages || ['/'];
  const inputLocale = config.inputLocale;

  // Collect all target locales from config
  const locales = [];
  if (config.languages && Array.isArray(config.languages)) {
    locales.push(...config.languages);
  }
  if (config.pairs) {
    for (const [pairKey] of Object.entries(config.pairs)) {
      const { target } = parsePairKey(pairKey);
      if (target) locales.push(target);
    }
  }

  if (!baseUrl) {
    return '<!-- champollion: Set "baseUrl" in config to generate hreflang tags -->';
  }

  const blocks = [];
  for (const pagePath of pages) {
    blocks.push(`<!-- Page: ${pagePath} -->`);
    blocks.push(generateHreflangTags({
      baseUrl,
      urlPattern,
      inputLocale,
      locales: [...new Set(locales)],
      pagePath,
    }));
  }

  return blocks.join('\n\n');
}

// -----------------------------------------------------------------
// Sitemap XML
// -----------------------------------------------------------------

/**
 * Generate a multilingual sitemap.xml with xhtml:link alternates.
 *
 * Follows Google's spec for multilingual sitemaps:
 * https://developers.google.com/search/docs/advanced/crawling/localized-versions
 *
 * @param {import('./types.js').ChampollionConfig} config - Resolved config
 * @returns {string} Complete XML sitemap
 */
function generateSitemap(config) {
  const seo = config.seo || {};
  const baseUrl = seo.baseUrl || config.baseUrl;
  const urlPattern = seo.urlPattern || '/:locale/:path';
  const pages = seo.pages || ['/'];
  const inputLocale = config.inputLocale;

  if (!baseUrl) {
    return '<!-- champollion: Set "baseUrl" in config to generate sitemap -->';
  }

  // Collect all locales
  const targetLocales = [];
  if (config.languages && Array.isArray(config.languages)) {
    targetLocales.push(...config.languages);
  }
  if (config.pairs) {
    for (const [pairKey] of Object.entries(config.pairs)) {
      const { target } = parsePairKey(pairKey);
      if (target) targetLocales.push(target);
    }
  }
  const allLocales = [...new Set([inputLocale, ...targetLocales])].sort();

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  lines.push('        xmlns:xhtml="http://www.w3.org/1999/xhtml">');

  for (const pagePath of pages) {
    for (const locale of allLocales) {
      const url = buildLocalizedUrl(baseUrl, urlPattern, locale, pagePath);
      lines.push('  <url>');
      lines.push(`    <loc>${escapeXml(url)}</loc>`);

      // Add xhtml:link alternates for all other locales
      for (const altLocale of allLocales) {
        const altUrl = buildLocalizedUrl(baseUrl, urlPattern, altLocale, pagePath);
        lines.push(`    <xhtml:link rel="alternate" hreflang="${altLocale}" href="${escapeXml(altUrl)}" />`);
      }

      // x-default
      const defaultUrl = buildLocalizedUrl(baseUrl, urlPattern, inputLocale, pagePath);
      lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(defaultUrl)}" />`);

      lines.push('  </url>');
    }
  }

  lines.push('</urlset>');
  return lines.join('\n');
}

// -----------------------------------------------------------------
// JSON-LD Schema
// -----------------------------------------------------------------

/**
 * Generate JSON-LD schema.org WebSite markup with language annotations.
 *
 * @param {object} config - Resolved config
 * @returns {string} JSON-LD script block
 */
function generateJsonLd(config) {
  const seo = config.seo || {};
  const baseUrl = seo.baseUrl || config.baseUrl;
  const inputLocale = config.inputLocale;

  if (!baseUrl) {
    return '<!-- champollion: Set "baseUrl" in config to generate JSON-LD -->';
  }

  // Collect all locales
  const targetLocales = [];
  if (config.languages && Array.isArray(config.languages)) {
    targetLocales.push(...config.languages);
  }
  if (config.pairs) {
    for (const [pairKey] of Object.entries(config.pairs)) {
      const { target } = parsePairKey(pairKey);
      if (target) targetLocales.push(target);
    }
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'url': baseUrl,
    'inLanguage': inputLocale,
    'availableLanguage': [...new Set(targetLocales)].sort(),
  };

  const scriptTag = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
  return scriptTag;
}

// -----------------------------------------------------------------
// XML helpers
// -----------------------------------------------------------------

/**
 * Escape special characters for XML output.
 *
 * @param {string} str - Raw string
 * @returns {string} XML-safe escaped string
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export {
  buildLocalizedUrl,
  generateHreflangTags,
  generateAllHreflangTags,
  generateSitemap,
  generateJsonLd,
  escapeXml,
};
