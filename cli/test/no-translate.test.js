#!/usr/bin/env node
/**
 * No-translate lane — keys whose correct translation is the source, verbatim.
 *
 * THE PRODUCTION INCIDENT THIS ENCODES (curtisforbes.com, four URL-valued
 * keys in locales/en.json):
 *
 *   The post-translation quality gate rejects source-echo. A URL's only
 *   correct translation IS the URL, so the correct answer always failed:
 *     - google/gemini-2.5-flash learned to defeat the gate by bending the
 *       URL — 48 corrupted values across 13 locales, including fabricated
 *       fragments (".../view/1954#fr"), a stray trailing "#", a U+200E
 *       LEFT-TO-RIGHT MARK prepended in Arabic and a U+200B ZERO WIDTH
 *       SPACE appended in Hindi. Those shipped, and the invisible ones
 *       broke the links outright.
 *     - stronger models returned the URL unchanged, correctly, and failed
 *       the gate — so `champollion sync` exited non-zero on every commit
 *       that touched en.json, and the pre-commit hook could not be
 *       satisfied except by disabling it.
 *
 * The fix is not a looser threshold; it is declaring the key out of scope.
 * These tests pin all four properties of that contract:
 *   never sent to a backend · never gated · never billed · byte-identical.
 *
 * Run: node --test test/no-translate.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  compileNoTranslate,
  compilePattern,
  isBareUrl,
  validateNoTranslateConfig,
} from '../lib/no-translate.js';
import { diffLocale } from '../lib/diff.js';
import { resolveConfig } from '../lib/config.js';
import { validateTranslations } from '../lib/validate.js';
import { auditLocalePair, findNoTranslateDrift } from '../lib/integrity.js';
import { exportXLIFF } from '../lib/xliff.js';
import { runSync } from '../lib/sync.js';
import { output } from '../lib/output.js';

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');
const PREFIX = '[EN] ';

// The four real keys from the incident, with their real value shapes.
const DISSERTATION = 'https://era.library.ualberta.ca/items/abcd-1234/view/1954';
const SPONGE_2018 = 'https://philpapers.org/rec/FORSPO-2';
const SPONGE_2011 = 'https://www.jstor.org/stable/41475266';
const PORTAL = 'https://github.com/curtisforbes/fairfolk-portal';

// -----------------------------------------------------------------
// Pattern grammar
// -----------------------------------------------------------------
describe('compilePattern — dot-path globs', () => {
  const matches = (pattern, key) => compilePattern(pattern)(key.split('.'));

  it('`**.url` matches a `url` leaf at any depth, including the root', () => {
    assert.equal(matches('**.url', 'pages.research.papers.phdDissertation.url'), true);
    assert.equal(matches('**.url', 'pages.software.fairfolkPortal.url'), true);
    assert.equal(matches('**.url', 'url'), true);
  });

  it('`**.url` does NOT match keys that merely contain or prefix "url"', () => {
    assert.equal(matches('**.url', 'pages.urlLabel'), false);
    assert.equal(matches('**.url', 'pages.url.caption'), false);
    assert.equal(matches('**.url', 'pages.myurl'), false);
  });

  it('`*` matches exactly one segment, never across a dot', () => {
    assert.equal(matches('pages.software.*.repo', 'pages.software.fairfolkPortal.repo'), true);
    assert.equal(matches('pages.software.*.repo', 'pages.software.a.b.repo'), false);
    assert.equal(matches('pages.software.*.repo', 'pages.software.repo'), false);
  });

  it('`*` also works inside a segment', () => {
    assert.equal(matches('meta.og*', 'meta.ogImage'), true);
    assert.equal(matches('meta.og*', 'meta.og'), true);
    assert.equal(matches('meta.og*', 'meta.twitterImage'), false);
    // Still bounded by the segment.
    assert.equal(matches('meta.og*', 'meta.og.image'), false);
  });

  it('a wildcard-free pattern is an exact dot-path', () => {
    assert.equal(matches('nav.brand', 'nav.brand'), true);
    assert.equal(matches('nav.brand', 'nav.brandName'), false);
    assert.equal(matches('nav.brand', 'footer.nav.brand'), false);
  });

  it('regex metacharacters in a pattern are literal, not operators', () => {
    // '.' is the segment separator, but '+' and '(' must not compile as regex.
    assert.equal(matches('a+b.c', 'a+b.c'), true);
    assert.equal(matches('a+b.c', 'aab.c'), false);
  });

  it('`**` in the middle spans any number of segments, including zero', () => {
    assert.equal(matches('pages.**.url', 'pages.url'), true);
    assert.equal(matches('pages.**.url', 'pages.a.b.c.url'), true);
    assert.equal(matches('pages.**.url', 'other.a.url'), false);
  });
});

// -----------------------------------------------------------------
// Bare-URL auto-detection
// -----------------------------------------------------------------
describe('isBareUrl — the auto-detect default', () => {
  it('accepts a value that IS one absolute URL', () => {
    for (const url of [DISSERTATION, SPONGE_2018, PORTAL, 'ftp://x.example/f', 'ipfs://Qm123']) {
      assert.equal(isBareUrl(url), true, url);
    }
  });

  it('tolerates surrounding whitespace', () => {
    assert.equal(isBareUrl(`  ${PORTAL}\n`), true);
  });

  it('rejects prose that merely CONTAINS a URL — that still needs translating', () => {
    assert.equal(isBareUrl(`Read the paper at ${SPONGE_2011}`), false);
    assert.equal(isBareUrl(`${PORTAL} — the source repository`), false);
  });

  it('rejects non-URLs', () => {
    assert.equal(isBareUrl('example.com'), false);
    assert.equal(isBareUrl('mailto:curtis@example.com'), false);
    assert.equal(isBareUrl('/relative/path'), false);
    assert.equal(isBareUrl(''), false);
    assert.equal(isBareUrl(42), false);
    assert.equal(isBareUrl(null), false);
  });
});

// -----------------------------------------------------------------
// Matcher assembly
// -----------------------------------------------------------------
describe('compileNoTranslate', () => {
  it('URL auto-detection is ON by default', () => {
    const m = compileNoTranslate({});
    assert.equal(m.active, true);
    assert.equal(m.matches('pages.research.papers.sponge2011.url', SPONGE_2011), true);
    assert.equal(m.reason('pages.research.papers.sponge2011.url', SPONGE_2011), 'auto-detected URL');
  });

  it('"noTranslateUrls": false opts out, leaving only explicit patterns', () => {
    const m = compileNoTranslate({ noTranslateUrls: false });
    assert.equal(m.active, false);
    assert.equal(m.matches('pages.x.url', PORTAL), false);
  });

  it('a pattern matches regardless of the value — it need not be a URL', () => {
    const m = compileNoTranslate({ noTranslate: ['nav.brand'], noTranslateUrls: false });
    assert.equal(m.matches('nav.brand', 'Curtis Forbes'), true);
    assert.equal(m.reason('nav.brand', 'Curtis Forbes'), 'pattern "nav.brand"');
    assert.equal(m.matches('nav.tagline', 'Curtis Forbes'), false);
  });

  it('a pattern still applies when URL auto-detection is off', () => {
    const m = compileNoTranslate({ noTranslate: ['**.url'], noTranslateUrls: false });
    assert.equal(m.matches('pages.software.fairfolkPortal.url', PORTAL), true);
  });
});

// -----------------------------------------------------------------
// Config validation — a bad value must never degrade to "translate it"
// -----------------------------------------------------------------
describe('no-translate config validation', () => {
  it('rejects a non-array noTranslate', () => {
    assert.throws(
      () => validateNoTranslateConfig('**.url', undefined),
      (e) => e.code === 'CHAMPOLLION_CONFIG_INVALID' && /must be an array/.test(e.message),
    );
  });

  it('rejects non-string and empty entries', () => {
    assert.throws(() => validateNoTranslateConfig([42], undefined), /non-empty strings/);
    assert.throws(() => validateNoTranslateConfig(['  '], undefined), /non-empty strings/);
  });

  it('rejects an empty path segment, pointing at `**`', () => {
    assert.throws(() => validateNoTranslateConfig(['pages..url'], undefined), /empty path segment/);
  });

  it('rejects a non-boolean noTranslateUrls', () => {
    assert.throws(() => validateNoTranslateConfig([], 'false'), /must be a boolean/);
  });

  it('accepts the documented shape', () => {
    assert.doesNotThrow(() => validateNoTranslateConfig(['**.url', 'pages.software.*.repo'], true));
    assert.doesNotThrow(() => validateNoTranslateConfig(undefined, undefined));
  });
});

describe('resolveConfig — noTranslate wiring', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-nt-cfg-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const writeConfig = (obj) =>
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify(obj, null, 2));

  it('defaults to no patterns and URL auto-detection on', () => {
    const config = resolveConfig({}, dir);
    assert.deepEqual(config.noTranslate, []);
    assert.equal(config.noTranslateUrls, true);
  });

  it('reads patterns from the config file without an unknown-field warning', () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(' '));
    try {
      writeConfig({ version: 3, noTranslate: ['**.url'], noTranslateUrls: false });
      const config = resolveConfig({}, dir);
      assert.deepEqual(config.noTranslate, ['**.url']);
      assert.equal(config.noTranslateUrls, false);
    } finally {
      console.warn = origWarn;
    }
    assert.deepEqual(warnings.filter(w => /noTranslate/.test(w)), []);
  });

  it('accepts `skipKeys` as a synonym and canonicalizes it', () => {
    writeConfig({ version: 3, skipKeys: ['**.url'] });
    const config = resolveConfig({}, dir);
    assert.deepEqual(config.noTranslate, ['**.url']);
    assert.equal(config.skipKeys, undefined, 'the alias must not survive into the resolved config');
  });

  it('refuses BOTH spellings at once rather than silently dropping one', () => {
    writeConfig({ version: 3, noTranslate: ['a'], skipKeys: ['b'] });
    assert.throws(
      () => resolveConfig({}, dir),
      (e) => e.code === 'CHAMPOLLION_CONFIG_INVALID' && /same field under two names/.test(e.message),
    );
  });

  it('a malformed noTranslate fails loud, and is NOT reported as a JSON syntax error', () => {
    writeConfig({ version: 3, noTranslate: '**.url' });
    assert.throws(
      () => resolveConfig({}, dir),
      (e) => e.code === 'CHAMPOLLION_CONFIG_INVALID' && !/Could not parse/.test(e.message),
    );
  });
});

// -----------------------------------------------------------------
// diffLocale routing
// -----------------------------------------------------------------
describe('diffLocale — no-translate routing', () => {
  const isUrl = compileNoTranslate({}).matches;
  const diff = (source, target, opts = {}) => diffLocale(
    source, target, PREFIX, opts.forceKeys || [], opts.changedKeys || [], null, isUrl,
  );

  it('a missing exempt key is queued for a verbatim copy, not for translation', () => {
    const d = diff({ 'papers.url': SPONGE_2011, greeting: 'Hello there' }, {});
    assert.deepEqual(d.noTranslate, ['papers.url']);
    assert.deepEqual(d.missing, ['greeting']);
    assert.deepEqual(d.toProcess, ['greeting'], 'the URL must never enter toProcess');
  });

  it('an exempt key already byte-identical is queued for nothing at all', () => {
    const d = diff({ 'papers.url': SPONGE_2011 }, { 'papers.url': SPONGE_2011 });
    assert.deepEqual(d.noTranslate, []);
    assert.deepEqual(d.untranslated, [], 'source-equal is the CORRECT state here');
    assert.deepEqual(d.toProcess, []);
  });

  it('a CORRUPTED exempt key is detected and queued for repair', () => {
    // The three real corruption shapes from the incident.
    const source = { a: DISSERTATION, b: PORTAL, c: SPONGE_2018 };
    const target = {
      a: `${DISSERTATION}#fr`,          // fabricated fragment
      b: `‎${PORTAL}`,             // LRM prepended (Arabic)
      c: `${SPONGE_2018}​`,        // ZWSP appended (Hindi)
    };
    const d = diff(source, target);
    assert.deepEqual(d.noTranslate.sort(), ['a', 'b', 'c']);
    assert.deepEqual(d.toProcess, [], 'repair is a copy, never a re-translation');
  });

  it('a changed exempt source is re-copied, not re-translated', () => {
    const d = diff(
      { 'papers.url': SPONGE_2018 },
      { 'papers.url': SPONGE_2011 },
      { changedKeys: ['papers.url'] },
    );
    assert.deepEqual(d.changed, []);
    assert.deepEqual(d.noTranslate, ['papers.url']);
    assert.deepEqual(d.toProcess, []);
  });

  it('an [EN]-prefixed exempt key is repaired, not sent to the backend', () => {
    const d = diff({ 'papers.url': SPONGE_2011 }, { 'papers.url': `${PREFIX}${SPONGE_2011}` });
    assert.deepEqual(d.needsTranslation, []);
    assert.deepEqual(d.noTranslate, ['papers.url']);
    assert.deepEqual(d.toProcess, []);
  });

  it('--force-keys does NOT override the exemption', () => {
    // Forcing re-translation of a key whose only correct output is the source
    // would just re-run the failure the exemption exists to prevent.
    const d = diff(
      { 'papers.url': SPONGE_2011 },
      { 'papers.url': SPONGE_2011 },
      { forceKeys: ['papers.url'] },
    );
    assert.deepEqual(d.forced, []);
    assert.deepEqual(d.toProcess, []);
  });

  it('non-string source values are left to the existing passthrough, not claimed', () => {
    const d = diffLocale(
      { count: 42, 'papers.url': SPONGE_2011 }, {}, PREFIX, [], [], null,
      () => true,   // claim EVERYTHING, to prove the string guard holds
    );
    assert.deepEqual(d.noTranslate, ['papers.url']);
    assert.deepEqual(d.missing, ['count']);
  });

  it('without a matcher the behaviour is exactly as before', () => {
    const d = diffLocale({ 'papers.url': SPONGE_2011 }, {}, PREFIX, [], []);
    assert.deepEqual(d.noTranslate, []);
    assert.deepEqual(d.missing, ['papers.url']);
    assert.deepEqual(d.toProcess, ['papers.url']);
  });
});

// -----------------------------------------------------------------
// The gate itself is unchanged — the key simply never reaches it
// -----------------------------------------------------------------
describe('quality gate — the failure that motivated this', () => {
  it('the gate still rejects a correctly-echoed URL (this is why exemption is needed)', () => {
    const source = { 'papers.url': SPONGE_2011 };
    const { validated, failures } = validateTranslations(
      { 'papers.url': SPONGE_2011 }, source, { target: 'fr' },
    );
    assert.deepEqual(Object.keys(validated), []);
    assert.equal(failures.length, 1);
    assert.match(failures[0].reason, /source echo/);
  });

  it('the gate also rejects a URL rendered into a non-Latin locale as ASCII', () => {
    // The other half of the trap: even a "changed" URL fails Arabic's script
    // check, so no output the model can produce is acceptable.
    const source = { 'papers.url': SPONGE_2011 };
    const { failures } = validateTranslations(
      { 'papers.url': `${SPONGE_2011}#ar` }, source, { target: 'ar' },
    );
    assert.equal(failures.length, 1);
    assert.match(failures[0].reason, /wrong script/);
  });
});

// -----------------------------------------------------------------
// Integrity: exemption + drift
// -----------------------------------------------------------------
describe('integrity — no-translate keys', () => {
  const matcher = compileNoTranslate({ noTranslate: ['nav.brand'], noTranslateUrls: true });

  it('an exempt key equal to its source is NOT reported as an untranslated copy', () => {
    const source = { 'nav.brand': 'Curtis Forbes', tagline: 'A philosopher' };
    const target = { 'nav.brand': 'Curtis Forbes', tagline: 'Un philosophe' };

    const without = auditLocalePair(source, target, 'fr');
    assert.deepEqual(without.copies, ['nav.brand'], 'baseline: it IS flagged without the matcher');

    const withMatcher = auditLocalePair(source, target, 'fr', { noTranslate: matcher });
    assert.deepEqual(withMatcher.copies, []);
    assert.deepEqual(withMatcher.noTranslateDrift, []);
  });

  it('drift is reported with the invisible character made visible', () => {
    const source = { 'papers.url': SPONGE_2011 };
    const target = { 'papers.url': `${SPONGE_2011}​` };

    const drift = findNoTranslateDrift(source, target, matcher);
    assert.equal(drift.length, 1);
    assert.equal(drift[0].key, 'papers.url');
    assert.equal(drift[0].expected, SPONGE_2011);
    assert.equal(drift[0].reason, 'auto-detected URL');
  });

  it('a key absent from the target is a missing key, not drift', () => {
    const drift = findNoTranslateDrift({ 'papers.url': SPONGE_2011 }, {}, matcher);
    assert.deepEqual(drift, []);
  });
});

// -----------------------------------------------------------------
// XLIFF: the human-translator lane needs the same exemption
// -----------------------------------------------------------------
describe('xliff export — no-translate units are locked', () => {
  const source = { 'papers.url': SPONGE_2011, tagline: 'A philosopher of science' };

  it('marks an exempt unit translate="no", final, and pre-filled', () => {
    const xliff = exportXLIFF({
      sourceLocale: 'en',
      targetLocale: 'fr',
      sourceFlat: source,
      targetFlat: {},
      noTranslate: compileNoTranslate({}),
    });

    assert.match(xliff, /<trans-unit id="papers\.url" translate="no"/);
    assert.match(xliff, new RegExp(`<target state="final">${SPONGE_2011.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}</target>`));
    // The ordinary key is untouched — still offered for translation.
    assert.match(xliff, /<trans-unit id="tagline" xml:space/);
    assert.match(xliff, /<target state="new"><\/target>/);
  });

  it('still emits the unit — the file stays a complete key inventory', () => {
    const xliff = exportXLIFF({
      sourceLocale: 'en', targetLocale: 'fr', sourceFlat: source, targetFlat: {},
      noTranslate: compileNoTranslate({}),
    });
    assert.equal((xliff.match(/<trans-unit /g) || []).length, 2);
  });

  it('without a matcher the output is byte-identical to the old behaviour', () => {
    const withNull = exportXLIFF({
      sourceLocale: 'en', targetLocale: 'fr', sourceFlat: source, targetFlat: { tagline: 'Un philosophe' },
    });
    assert.equal(withNull.includes('translate="no"'), false);
    assert.match(withNull, /<trans-unit id="papers\.url" xml:space/);
  });
});

// -----------------------------------------------------------------
// End-to-end: the curtisforbes.com case, hermetic
//
// Real runSync + the google-translate method + a stubbed globalThis.fetch,
// so nothing touches the network and no key is needed.
// -----------------------------------------------------------------
describe('sync e2e — URL keys round-trip byte-identical and never reach the backend', () => {
  let dir;
  let localesDir;
  let originalFetch;
  let savedGoogleKey;
  let savedOpenRouterKey;
  let fetchBodies;
  let origLog;
  let origWrite;

  // Mirrors the site: four URL keys plus ordinary translatable copy.
  const EN = {
    pages: {
      research: {
        heading: 'Selected research and published papers',
        papers: {
          phdDissertation: { title: 'Doctoral dissertation', url: DISSERTATION },
          sponge2018: { title: 'The sponge argument, revisited', url: SPONGE_2018 },
          sponge2011: { title: 'The sponge argument', url: SPONGE_2011 },
        },
      },
      software: {
        heading: 'Software and tools',
        fairfolkPortal: { title: 'Fairfolk Portal', url: PORTAL },
      },
    },
  };

  const URL_KEYS = [
    'pages.research.papers.phdDissertation.url',
    'pages.research.papers.sponge2018.url',
    'pages.research.papers.sponge2011.url',
    'pages.software.fairfolkPortal.url',
  ];
  const URL_VALUES = [DISSERTATION, SPONGE_2018, SPONGE_2011, PORTAL];
  const LOCALES = ['fr', 'ar', 'hi'];

  // Stand-in translations for the ORDINARY keys. ar/hi must be non-Latin (the
  // script check) and non-degenerate (the repetition check), so map each
  // source character onto a rotating alphabet: deterministic, same length as
  // the source, and varied enough not to read as a hallucination loop.
  const ALPHABETS = {
    ar: 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي',
    hi: 'कखगघचछजझटठडढणतथदधनपफबभमयरलवशषसह',
  };
  const stubTranslate = (text, target) => {
    const alphabet = ALPHABETS[target];
    if (!alphabet) return `FR(${text})`;
    return [...text]
      .map((ch, i) => (ch === ' ' ? ' ' : alphabet[(ch.charCodeAt(0) + i * 7) % alphabet.length]))
      .join('');
  };

  const readLocale = (code) =>
    JSON.parse(fs.readFileSync(path.join(localesDir, `${code}.json`), 'utf-8'));

  const urlAt = (obj, dotted) => dotted.split('.').reduce((o, k) => o?.[k], obj);

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-notranslate-'));
    localesDir = path.join(dir, 'locales');
    fs.mkdirSync(localesDir);
    fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify(EN, null, 2));
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3,
      inputLocale: 'en',
      localesDir: './locales',
      languages: LOCALES,
      defaultMethod: 'google-translate',
      noTranslate: ['**.url'],
    }, null, 2));

    savedGoogleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    savedOpenRouterKey = process.env.OPENROUTER_API_KEY;
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-key';
    // No OpenRouter key → translate-pair's feedback retry stays off, so the
    // fetch count below is exact.
    delete process.env.OPENROUTER_API_KEY;

    fetchBodies = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      fetchBodies.push(body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            translations: body.q.map((text) => ({
              // If a URL ever reaches the backend, hand back the exact
              // corruption gemini-2.5-flash produced. The byte-identity
              // assertions then fail on CONTENT, not just on a call count.
              translatedText: /^https?:\/\//.test(text.trim())
                ? `${text}#${body.target}`
                : stubTranslate(text, body.target),
            })),
          },
        }),
      };
    };

    // runSync writes a progress bar straight to stdout; keep the test output
    // readable without suppressing the assertions' subject matter.
    origLog = console.log;
    origWrite = process.stdout.write.bind(process.stdout);
    output.setMode('quiet');
    process.stdout.write = () => true;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.log = origLog;
    process.stdout.write = origWrite;
    output.setMode('default');
    if (savedGoogleKey === undefined) delete process.env.GOOGLE_TRANSLATE_API_KEY;
    else process.env.GOOGLE_TRANSLATE_API_KEY = savedGoogleKey;
    if (savedOpenRouterKey !== undefined) process.env.OPENROUTER_API_KEY = savedOpenRouterKey;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** Every source string the stub was ever asked to translate. */
  const allRequestedTexts = () => fetchBodies.flatMap(b => b.q);

  it('copies every URL byte-identically, sends none of them, and passes the gate', async () => {
    const result = await runSync({ cwd: dir, cliArgs: {} });

    // 1. Never sent to a backend.
    for (const text of allRequestedTexts()) {
      assert.equal(isBareUrl(text), false, `a URL reached the translation backend: ${text}`);
    }
    for (const value of URL_VALUES) {
      assert.equal(allRequestedTexts().includes(value), false, `${value} was sent for translation`);
    }

    // 2. Byte-identical in every locale — compared as bytes, because the
    //    corruption class this prevents is invisible in a rendered string.
    const enBytes = URL_KEYS.map(k => Buffer.from(urlAt(EN, k), 'utf-8'));
    for (const code of LOCALES) {
      const target = readLocale(code);
      URL_KEYS.forEach((key, i) => {
        const actual = urlAt(target, key);
        assert.equal(typeof actual, 'string', `${code}: ${key} is missing`);
        assert.equal(
          Buffer.compare(Buffer.from(actual, 'utf-8'), enBytes[i]), 0,
          `${code}: ${key} is not byte-identical to the source (got ${JSON.stringify(actual)})`,
        );
      });
    }

    // 3. Never counted as a failure — and the ordinary keys DID translate.
    assert.equal(result.totalFailed, 0, 'no key may fail the quality gate');
    assert.equal(result.verifyErrors, 0, 'post-sync verification must be clean');
    assert.equal(result.totalCopied, URL_KEYS.length * LOCALES.length);
    assert.equal(
      readLocale('fr').pages.software.heading, 'FR(Software and tools)',
      'ordinary keys are still translated normally',
    );
  });

  it('is idempotent — a second sync copies nothing and calls nothing', async () => {
    await runSync({ cwd: dir, cliArgs: {} });
    const firstRunCalls = fetchBodies.length;
    assert.ok(firstRunCalls > 0, 'the first run did translate the ordinary keys');

    const second = await runSync({ cwd: dir, cliArgs: {} });

    assert.equal(fetchBodies.length, firstRunCalls, 'the second sync makes no API call');
    assert.equal(second.totalCopied, 0, 'settled URLs must not be re-copied every sync');
    assert.equal(second.totalProcessed, 0);
    assert.equal(second.totalFailed, 0);
  });

  it('repairs the exact corruptions that shipped to production', async () => {
    // Seed each locale with a real observed defect, as if a weaker model had
    // already written it. Every non-URL key is left correct so the repair is
    // isolated from ordinary translation work.
    const corrupted = {
      fr: `${DISSERTATION}#fr`,          // fabricated fragment
      ar: `‎${DISSERTATION}`,       // LEFT-TO-RIGHT MARK prepended
      hi: `${DISSERTATION}​`,       // ZERO WIDTH SPACE appended
    };
    await runSync({ cwd: dir, cliArgs: {} });   // establish a clean baseline
    for (const code of LOCALES) {
      const data = readLocale(code);
      data.pages.research.papers.phdDissertation.url = corrupted[code];
      fs.writeFileSync(path.join(localesDir, `${code}.json`), JSON.stringify(data, null, 2));
    }
    const callsBefore = fetchBodies.length;

    const result = await runSync({ cwd: dir, cliArgs: {} });

    assert.equal(fetchBodies.length, callsBefore, 'a repair costs zero API calls');
    assert.equal(result.totalCopied, LOCALES.length);
    assert.equal(result.totalFailed, 0);
    for (const code of LOCALES) {
      const actual = readLocale(code).pages.research.papers.phdDissertation.url;
      assert.equal(
        Buffer.compare(Buffer.from(actual, 'utf-8'), Buffer.from(DISSERTATION, 'utf-8')), 0,
        `${code}: corruption was not repaired (still ${JSON.stringify(actual)})`,
      );
    }
  });

  it('--max-cost 0 does not abort a URL-only sync — the keys are never billed', async () => {
    await runSync({ cwd: dir, cliArgs: {} });
    // Wipe the URLs so the ONLY pending work is no-translate copies.
    for (const code of LOCALES) {
      const data = readLocale(code);
      data.pages.research.papers.sponge2011.url = 'https://wrong.example/';
      fs.writeFileSync(path.join(localesDir, `${code}.json`), JSON.stringify(data, null, 2));
    }

    const result = await runSync({ cwd: dir, cliArgs: { 'max-cost': '0' } });

    assert.notEqual(result.maxCostAborted, true, 'a $0 workload must not trip the cap');
    assert.equal(result.totalCopied, LOCALES.length);
    for (const code of LOCALES) {
      assert.equal(readLocale(code).pages.research.papers.sponge2011.url, SPONGE_2011);
    }
  });

  it('`audit` and `integrity` stay green after the sync (the site build runs both)', async () => {
    await runSync({ cwd: dir, cliArgs: {} });

    for (const command of ['audit', 'integrity']) {
      const res = runCLI([command], dir);
      assert.equal(res.status, 0, `champollion ${command} exited ${res.status}:\n${res.stdout}${res.stderr}`);
    }
  });

  it('`integrity` FAILS on drift, naming the repair — the check that was missing', async () => {
    await runSync({ cwd: dir, cliArgs: {} });
    const data = readLocale('hi');
    data.pages.software.fairfolkPortal.url = `${PORTAL}​`;
    fs.writeFileSync(path.join(localesDir, 'hi.json'), JSON.stringify(data, null, 2));

    const res = runCLI(['integrity'], dir);
    assert.equal(res.status, 1, 'a drifted no-translate key must fail the build');
    assert.match(res.stdout, /NO-TRANSLATE DRIFT/);
    assert.match(res.stdout, /champollion sync/, 'the report must name the fix');
    assert.match(res.stdout, /\\u200b/i, 'the invisible character must be shown escaped');
  });
});

/** Run the real CLI binary; capture stdout/stderr/exit regardless of code. */
function runCLI(args, cwd) {
  try {
    const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], {
      cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', status: err.status ?? 1 };
  }
}
