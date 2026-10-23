/**
 * Geo-IP locale defaulting for champollion.dev (founder decision 2026-07-18):
 * first-time visitors get the locale of the country their request comes from
 * — NOT their browser's Accept-Language. A visitor from the Philippines sees
 * the site in Filipino even if their browser is set to English.
 *
 * Geography is a ONE-TIME DEFAULT, never a lock. The visitor can always
 * switch — and any switch (including back to English) is honored immediately
 * and remembered.
 *
 * HOW IT WORKS (consumed by middleware.js, which runs on Vercel's edge):
 *   - Vercel stamps every request with the `x-vercel-ip-country` header
 *     (ISO 3166-1 alpha-2, derived from the connecting IP; client-supplied
 *     values are overwritten by the platform, so it cannot be spoofed).
 *   - FIRST CONTACT only: a browser with no locale cookie, navigating to an
 *     en (un-prefixed) path from a geo-mapped country, 302-redirects to the
 *     same path under /<locale>/ and records the locale in a cookie. That
 *     cookie means "this browser has been handled" — geography never fires
 *     for it again.
 *   - After that, the choice is entirely the visitor's: visiting any
 *     /<locale>/ path records that locale, and reaching any en path (typing
 *     the root, or picking "English" in the navbar dropdown) records `en` and
 *     is served as-is. A stored locale NEVER redirects an en path back to
 *     itself — that was the trap that stranded PH/Arc visitors on /fil/ with
 *     no way to English. The decision reads only the request itself (path,
 *     cookie, country); it does NOT depend on the fragile Referer header.
 *
 * This module is PURE (no Vercel imports) so the routing decision is
 * unit-testable from cli/test/ — see website-geo-locale.test.js.
 */

// Non-default site locales, mirroring docusaurus.config.js i18n.locales
// (en is the default and lives at the un-prefixed root).
const SITE_LOCALES = ['fr', 'de', 'nl', 'fil', 'es', 'zh', 'ja', 'ko', 'pt', 'th', 'vi', 'ar'];

const LOCALE_COOKIE = 'champollion_locale';

/**
 * Country → site-locale routing defaults. This is UX routing config (which
 * build of OUR site a country most plausibly wants first), not an assertion
 * about what languages a country speaks — deliberately NOT derived from
 * language cards. Multilingual countries with no clear single site-locale
 * (BE, CH, LU, SG, CA, CM, RW, KM, DJ, ...) are intentionally unmapped and
 * fall through to the en default; the navbar dropdown is one click away.
 * Each country appears at most once.
 */
const COUNTRY_LOCALE = {
  // Filipino
  PH: 'fil',
  // Thai
  TH: 'th',
  // Vietnamese
  VN: 'vi',
  // Japanese
  JP: 'ja',
  // Korean
  KR: 'ko', KP: 'ko',
  // Chinese (the site serves a single zh build)
  CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh',
  // German
  DE: 'de', AT: 'de', LI: 'de',
  // Dutch
  NL: 'nl', SR: 'nl',
  // French — France, Monaco, Haiti, majority-francophone Africa
  FR: 'fr', MC: 'fr', HT: 'fr',
  SN: 'fr', CI: 'fr', ML: 'fr', BF: 'fr', NE: 'fr', TG: 'fr', BJ: 'fr',
  GA: 'fr', CG: 'fr', CD: 'fr', GN: 'fr', TD: 'fr', CF: 'fr',
  // Spanish — Spain + Hispanophone Americas + Equatorial Guinea
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', VE: 'es', CL: 'es',
  EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
  SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', GQ: 'es',
  // Portuguese
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt', TL: 'pt',
  // Arabic
  SA: 'ar', AE: 'ar', EG: 'ar', IQ: 'ar', JO: 'ar', KW: 'ar', LB: 'ar',
  LY: 'ar', OM: 'ar', QA: 'ar', SY: 'ar', YE: 'ar', BH: 'ar', PS: 'ar',
  SD: 'ar', MA: 'ar', DZ: 'ar', TN: 'ar', MR: 'ar',
};

/**
 * Extract the site locale a path is under, or null for default-locale (en)
 * paths. '/fil' and '/fil/docs/x' are fil; '/free' is not (no bare-prefix
 * false positives).
 */
function pathLocaleOf(pathname) {
  if (!pathname) return null;
  return SITE_LOCALES.find(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`)) || null;
}

/**
 * Decide how to route one request. Pure function of the request facts —
 * deliberately independent of the Referer header (its path is stripped by
 * common referrer policies and some browsers, which is what used to strand
 * geo-defaulted visitors on their locale with no way back to English).
 *
 * @param {object} facts
 * @param {string} facts.pathname - URL path
 * @param {string} [facts.method='GET']
 * @param {string|null} [facts.accept] - Accept request header (redirects require text/html)
 * @param {string|null} [facts.cookieLocale] - value of the champollion_locale cookie
 * @param {string|null} [facts.country] - x-vercel-ip-country (ISO alpha-2)
 * @returns {{ action: 'passthrough' } |
 *           { action: 'remember', locale: string } |
 *           { action: 'redirect', locale: string }}
 *   'remember' = serve as-is but persist the locale cookie;
 *   'redirect' = 302 to the same path under /<locale>/ and persist the cookie.
 */
function decideLocaleRouting({ pathname, method = 'GET', accept = null, cookieLocale = null, country = null }) {
  if (method !== 'GET' && method !== 'HEAD') return { action: 'passthrough' };

  // Browser NAVIGATIONS only. curl/pip/agents fetch with Accept: */* (or
  // none) — redirecting those breaks machine consumers of extensionless
  // paths (`curl champollion.dev/run_queue | bash` would pipe a 302 body).
  // Every real browser sends text/html on page navigations.
  if (!String(accept || '').includes('text/html')) return { action: 'passthrough' };

  // Files (assets, feeds, .json/.xml endpoints) are locale-independent.
  if (/\.[^/]+$/.test(pathname)) return { action: 'passthrough' };

  // Already on a locale build: that IS an explicit choice — record it.
  const pathLocale = pathLocaleOf(pathname);
  if (pathLocale) {
    return cookieLocale === pathLocale
      ? { action: 'passthrough' }
      : { action: 'remember', locale: pathLocale };
  }

  // Default-locale (en) path. If this browser has already been handled (it
  // carries a valid locale cookie), geography is DONE — reaching an en URL is
  // a manual act (typing the root, or picking "English" in the navbar), so
  // serve English and record it. A stored locale never bounces an en path
  // back to itself; that was the trap. Only a genuinely first-contact browser
  // (no valid cookie) gets the one-time geo default.
  const handled = cookieLocale === 'en' || SITE_LOCALES.includes(cookieLocale);
  if (handled) {
    return cookieLocale === 'en'
      ? { action: 'passthrough' }
      : { action: 'remember', locale: 'en' };
  }

  const geoLocale = country ? COUNTRY_LOCALE[country.toUpperCase()] : undefined;
  if (geoLocale) return { action: 'redirect', locale: geoLocale };

  return { action: 'passthrough' };
}

/**
 * Build the redirect target for a locale: same path + query under /<locale>/.
 * '/' → '/fil/', '/docs/intro' → '/fil/docs/intro'.
 */
function localeRedirectTarget(locale, pathname, search = '') {
  return `/${locale}${pathname}${search}`;
}

/** Set-Cookie value persisting a locale choice for a year. */
function localeCookieHeader(locale) {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
}

export {
  SITE_LOCALES,
  LOCALE_COOKIE,
  COUNTRY_LOCALE,
  pathLocaleOf,
  decideLocaleRouting,
  localeRedirectTarget,
  localeCookieHeader,
};
