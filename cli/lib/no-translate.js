/**
 * no-translate.js — keys whose correct translation is the source, verbatim.
 *
 * THE PROBLEM THIS SOLVES:
 *   Some values have exactly one correct rendering in every locale: a URL,
 *   a repo path, a package name. The post-translation quality gate rejects
 *   source-echo (lib/validate.js check 2), so for these keys the CORRECT
 *   answer always FAILS. That has two observed failure modes, both real,
 *   both seen in production:
 *
 *     1. Weak models learn to defeat the gate by bending the value just
 *        enough to stop being an echo. Observed on a live site: 48 corrupted
 *        URLs across 13 locales — fabricated fragments (".../view/1954#fr"),
 *        stray trailing "#" and "/", a U+200E LEFT-TO-RIGHT MARK prepended
 *        in Arabic, a U+200B ZERO WIDTH SPACE appended in Hindi. The
 *        invisible-character ones break the link outright.
 *     2. Strong models return the value unchanged, correctly, and fail the
 *        gate — so `champollion sync` exits non-zero forever. A pre-commit
 *        hook wired to sync can then never be satisfied, and the only way
 *        past is to disable the whole gate.
 *
 *   There is no threshold that fixes this, because the gate is asking the
 *   wrong question. The fix is to declare the key out of scope: never send
 *   it to a backend, never gate it, never bill it — copy it verbatim.
 *
 * TWO WAYS A KEY BECOMES NO-TRANSLATE:
 *   1. `noTranslate` config patterns — dot-path keys and/or globs:
 *        "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
 *   2. Auto-detected bare URLs — a source value that is nothing but a
 *      `scheme://…` URL. On by default (`noTranslateUrls`), because the
 *      current behaviour has no correct outcome. Opt out with
 *      `"noTranslateUrls": false`.
 *
 * WHERE IT PLUGS IN: `diffLocale` (lib/diff.js) takes the resulting matcher
 * and routes matching keys into a `noTranslate` bucket instead of
 * `toProcess`. Because the cost estimator diffs with the same matcher, the
 * keys are excluded from the bill by construction rather than by a second
 * rule that could drift.
 */

/**
 * A value is "a bare URL" when the whole thing, trimmed, is one absolute
 * URL and nothing else.
 *
 * Deliberately NOT a substring match: "Read the paper at https://…" is
 * prose with a URL in it and must still be translated. Only a value that
 * IS the URL has no translatable content.
 *
 * Scheme grammar follows RFC 3986 (ALPHA *( ALPHA / DIGIT / "+" / "-" / "."))
 * and requires the `://` authority form, so `https://`, `ftp://` and
 * `ipfs://` match while `mailto:` and a bare `example.com` do not.
 */
const BARE_URL = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;

/**
 * Is this source value a bare URL?
 *
 * @param {unknown} value - Source value to test
 * @returns {boolean} True when the trimmed value is exactly one absolute URL
 */
function isBareUrl(value) {
  return typeof value === 'string' && BARE_URL.test(value.trim());
}

/**
 * Compile one dot-path pattern into a segment matcher.
 *
 * Pattern grammar (segments split on `.`):
 *   - a literal segment matches that segment exactly
 *   - `*`  matches any characters WITHIN one segment (`page*` → `pageTitle`)
 *   - `**` matches zero or more whole segments (`**.url` matches `a.b.url`
 *     and a top-level `url`)
 *   - a pattern with no wildcard is an exact dot-path
 *
 * @param {string} pattern - e.g. '**.url', 'pages.software.*.repo'
 * @returns {(keySegments: string[]) => boolean} Segment-array matcher
 */
function compilePattern(pattern) {
  const patternSegments = pattern.split('.');

  // Per-segment regexes, built once. `**` is handled structurally below and
  // never reaches this map.
  const segmentTests = patternSegments.map(seg => {
    if (seg === '**') return null;
    if (!seg.includes('*')) return (s) => s === seg;
    // Escape everything regex-significant, then turn `*` into "any run of
    // characters that is not a segment separator".
    const source = '^' + seg
      .split('*')
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^.]*') + '$';
    const re = new RegExp(source);
    return (s) => re.test(s);
  });

  /**
   * Classic backtracking glob match over segment arrays. Locale key depth is
   * small (single digits), so recursion is cheap and the code stays readable.
   */
  function match(pi, ki, keySegments) {
    if (pi === patternSegments.length) return ki === keySegments.length;

    if (patternSegments[pi] === '**') {
      // `**` consumes zero or more segments — try every split point.
      for (let skip = ki; skip <= keySegments.length; skip++) {
        if (match(pi + 1, skip, keySegments)) return true;
      }
      return false;
    }

    if (ki >= keySegments.length) return false;
    if (!segmentTests[pi](keySegments[ki])) return false;
    return match(pi + 1, ki + 1, keySegments);
  }

  return (keySegments) => match(0, 0, keySegments);
}

/**
 * Validate the no-translate config fields, failing loud on anything the
 * matcher could not honour.
 *
 * A misspelled or wrong-typed `noTranslate` must never degrade to "translate
 * everything": the user wrote it precisely so certain keys would be left
 * alone, and silently ignoring it re-opens the corruption path this module
 * exists to close.
 *
 * @param {unknown} patterns - Raw config.noTranslate
 * @param {unknown} urls - Raw config.noTranslateUrls
 * @throws {Error} With code CHAMPOLLION_CONFIG_INVALID
 */
function validateNoTranslateConfig(patterns, urls) {
  const fail = (message) => {
    const e = new Error(message);
    e.code = 'CHAMPOLLION_CONFIG_INVALID';
    throw e;
  };

  if (patterns != null) {
    if (!Array.isArray(patterns)) {
      fail(
        '"noTranslate" must be an array of dot-path keys or glob patterns, '
        + `got ${typeof patterns}. Example: "noTranslate": ["**.url", "pages.software.*.repo"]`,
      );
    }
    for (const p of patterns) {
      if (typeof p !== 'string' || p.trim() === '') {
        fail(`"noTranslate" entries must be non-empty strings — found ${JSON.stringify(p)}.`);
      }
      if (p.includes('..')) {
        fail(`"noTranslate" pattern "${p}" has an empty path segment. Use "**" to match any depth.`);
      }
    }
  }

  if (urls != null && typeof urls !== 'boolean') {
    fail(`"noTranslateUrls" must be a boolean, got ${typeof urls}. Set it to false to translate URL-valued keys.`);
  }
}

/**
 * Build the no-translate matcher for a resolved config.
 *
 * @param {object} config - Resolved config (reads `noTranslate`, `noTranslateUrls`)
 * @returns {NoTranslateMatcher}
 *
 * @typedef {object} NoTranslateMatcher
 * @property {boolean} active - False when nothing is configured and URL
 *   auto-detection is off. Callers can skip the whole lane.
 * @property {(key: string, value: unknown) => boolean} matches - Is this key
 *   exempt from translation?
 * @property {(key: string, value: unknown) => string|null} reason - Why it is
 *   exempt ('pattern "**.url"' / 'auto-detected URL'), or null.
 * @property {string[]} patterns - The configured patterns, for reporting.
 * @property {boolean} urls - Whether URL auto-detection is on.
 */
function compileNoTranslate(config = {}) {
  validateNoTranslateConfig(config.noTranslate, config.noTranslateUrls);

  const patterns = Array.isArray(config.noTranslate) ? [...config.noTranslate] : [];
  const urls = config.noTranslateUrls !== false;
  const compiled = patterns.map(p => ({ pattern: p, test: compilePattern(p) }));

  // Segment splits are pure and repeated across every locale in a run.
  const segmentCache = new Map();
  const segmentsOf = (key) => {
    let segs = segmentCache.get(key);
    if (!segs) {
      segs = key.split('.');
      segmentCache.set(key, segs);
    }
    return segs;
  };

  const reason = (key, value) => {
    const segs = segmentsOf(key);
    for (const { pattern, test } of compiled) {
      if (test(segs)) return `pattern "${pattern}"`;
    }
    if (urls && isBareUrl(value)) return 'auto-detected URL';
    return null;
  };

  return {
    active: compiled.length > 0 || urls,
    matches: (key, value) => reason(key, value) !== null,
    reason,
    patterns,
    urls,
  };
}

/**
 * Matcher that exempts nothing — for callers with no config in hand.
 *
 * @type {NoTranslateMatcher}
 */
const NO_TRANSLATE_NONE = {
  active: false,
  matches: () => false,
  reason: () => null,
  patterns: [],
  urls: false,
};

export {
  compileNoTranslate,
  compilePattern,
  isBareUrl,
  validateNoTranslateConfig,
  NO_TRANSLATE_NONE,
  BARE_URL,
};
