/**
 * disguised-echo.test.js — the quality gate refuses the source handed back
 * with accents sprinkled on.
 *
 * 'Thank you very much!' → 'Thánk yóú véry múch!' is a copy, not a
 * translation, but `translated === source` calls it different, and the script
 * check cannot fire (Latin in, Latin out; in a non-Latin target the accents
 * make it not-ASCII). The harness caught it first (its shared normalizer,
 * arena/mt_eval_harness/text_compare.py); the CLI gate now folds case,
 * diacritics, spacing and format characters the same way — but only for a
 * source of 3+ words with letters, because 'cafe' → 'café' and
 * 'Resume' → 'Résumé' are correct short translations in Latin targets.
 *
 * Pinned:
 *   1. the gate decision (validateTranslations): refused when it should be,
 *      exact-equality behaviour for short strings unchanged, exemptions
 *      (declared names, letter-free text) still honoured;
 *   2. the retry path behaves as for any echo — one feedback retry naming the
 *      reason, a disguised copy is never cached, and a poisoned TM entry from
 *      an older gate is evicted and healed;
 *   3. the fallback path behaves as for any echo — what the primary keeps
 *      copying goes to the fallback method through the same gate;
 *   4. no-translate keys never meet the check (copied verbatim, unbilled).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  validateTranslations,
  isDisguisedEcho,
  foldForEchoCompare,
  letterWordCount,
  MIN_FOLDED_ECHO_WORDS,
  LATIN_NAME_OR_LABEL,
} from '../lib/validate.js';
import { METHOD_REGISTRY } from '../lib/translate.js';
import { TranslationMethod } from '../lib/methods/base.js';
import { translateAndValidate, translateWithFallback } from '../lib/translate-pair.js';
import { resolvePairs } from '../lib/pairs.js';
import { lookupTM, storeTM, tmMethodKey, TM_DIR, TM_FILENAME } from '../lib/tm.js';
import { runSync } from '../lib/sync.js';
import { output } from '../lib/output.js';

const THANKS = 'Thank you very much!';
const THANKS_ACCENTED = 'Thánk yóú véry múch!';

/** validateTranslations for one key → { ok, failure }. */
function gate(source, translated, target, extra = {}) {
  const { validated, failures } = validateTranslations(
    { k: translated }, { k: source }, { target, ...extra.pair }, extra.options || {},
  );
  return { ok: 'k' in validated, failure: failures[0] || null };
}

// =================================================================
// 1. The gate decision
// =================================================================

describe('disguised echo — the gate decision', () => {
  it('a multi-word accented copy is refused in Latin-script targets (fra, sme)', () => {
    for (const target of ['fr', 'sme']) {
      const { ok, failure } = gate(THANKS, THANKS_ACCENTED, target);
      assert.equal(ok, false, `${target}: accepted a disguised copy`);
      assert.match(failure.reason, /source echo/);
      assert.equal(failure.disguisedEcho, true);
      assert.equal(failure.nameOrLabel, undefined, 'a disguised copy is never offered the name lane');
    }
  });

  it('it is refused in a non-Latin target too — the accents dodged the ASCII script check', () => {
    const { ok, failure } = gate(THANKS, THANKS_ACCENTED, 'ru');
    assert.equal(ok, false);
    assert.equal(failure.disguisedEcho, true);
    assert.notEqual(failure.reason, LATIN_NAME_OR_LABEL);
  });

  it('every disguise folds away: case, spacing, invisible characters, fullwidth letters', () => {
    const src = 'Save your changes before leaving';
    for (const disguised of [
      'save your changes before leaving',
      'SAVE YOUR CHANGES BEFORE LEAVING',
      'Save  your changes   before leaving ',
      'Save​ your‎ changes­ before leaving',
      'Ｓａｖｅ ｙｏｕｒ ｃｈａｎｇｅｓ ｂｅｆｏｒｅ ｌｅａｖｉｎｇ',
      'Sávé yóúr chángés béfóré léávíng',
    ]) {
      assert.equal(gate(src, disguised, 'fr').ok, false, JSON.stringify(disguised));
    }
  });

  it('short legitimate translations that differ only by accents are accepted', () => {
    assert.equal(gate('cafe', 'café', 'fr').ok, true);
    assert.equal(gate('Resume', 'Résumé', 'fr').ok, true);
    assert.equal(gate('Cafe Menu', 'Café Menu', 'fr').ok, true, 'two words: exact equality only');
  });

  it('placeholders, printf conversions and tags are not words', () => {
    assert.equal(letterWordCount('{count} files'), 1);
    assert.equal(letterWordCount('Delete %1$s now'), 2);
    assert.equal(letterWordCount('<a href="/x">Read</a> more'), 2);
    assert.equal(gate('Delete {name} now', 'Délété {name} nów', 'fr').ok, true, 'two words with letters');
    assert.equal(gate('Delete {name} right now', 'Délété {name} ríght nów', 'fr').ok, false);
  });

  it('a real translation of a multi-word source is accepted', () => {
    assert.equal(gate(THANKS, 'Merci beaucoup !', 'fr').ok, true);
    assert.equal(gate(THANKS, 'Giitu ollu!', 'sme').ok, true);
  });

  it('exact-equality behaviour for short strings is unchanged', () => {
    // A short name kept as written: accepted in a Latin target…
    assert.equal(gate('GitHub', 'GitHub', 'fr').ok, true);
    // …asked about once in a non-Latin target (the name-or-label lane)…
    assert.equal(gate('GitHub', 'GitHub', 'ru').failure.nameOrLabel, true);
    // …and an exact copy of a short multi-word ASCII string keeps today's
    // short-label lane: only the DISGUISED copy is new.
    assert.equal(gate(THANKS, THANKS, 'fr').ok, true);
    assert.equal(gate(THANKS, THANKS, 'ru').failure.nameOrLabel, true);
    // A long exact echo is refused exactly as before.
    const long = 'This sentence is far longer than thirty characters in total.';
    assert.equal(gate(long, long, 'fr').failure.reason, 'source echo (identical to English)');
  });

  it('a declared name is accepted before the check (protectedTerms)', () => {
    // The English copy omits the accents; the project declared the name in
    // its own spelling. Without the declaration the same value is refused.
    const src = 'Societe Generale Bank';
    const out = 'Société Générale Bank';
    assert.equal(gate(src, out, 'fr').ok, false);
    assert.equal(gate(src, out, 'fr', { pair: { protectedTerms: ['Société Générale Bank'] } }).ok, true);
  });

  it('letter-free text is compared literally — localized numbers are translations', () => {
    assert.equal(gate('1,000 / 2,000 / 3,000', '1 000 / 2 000 / 3 000', 'fr').ok, true);
  });

  it('isDisguisedEcho: exact copies keep their own rule; the floor is 3 words', () => {
    assert.equal(MIN_FOLDED_ECHO_WORDS, 3);
    assert.equal(isDisguisedEcho(THANKS, THANKS), false, 'an exact copy is the older rule\'s business');
    assert.equal(isDisguisedEcho(THANKS, THANKS_ACCENTED), true);
    assert.equal(isDisguisedEcho('Thank you', 'Thánk yóú'), false);
    assert.equal(foldForEchoCompare('Straße'), foldForEchoCompare('STRASSE'));
    assert.equal(foldForEchoCompare('ŋ'), 'ŋ', 'a letter is not a mark');
  });
});

// =================================================================
// 2. The retry path (translateAndValidate) — as for any echo
// =================================================================

class EchoFake {
  async translate(keys, sourceFlat, pairConfig, options) {
    EchoFake.calls.push({ keys: [...keys], options });
    return EchoFake.responses.shift() ?? null;
  }
}
EchoFake.calls = [];
EchoFake.responses = [];
METHOD_REGISTRY['test-disguised-echo'] = EchoFake;

const FR_PAIR = { target: 'fr', method: 'test-disguised-echo', name: 'French', register: 'professional' };
const FR_TM_KEY = tmMethodKey(FR_PAIR);
const KEY = 'footer.thanks';
const SOURCE = { [KEY]: THANKS };

/** Run `fn` with the pipeline's progress and gate logging kept off the test output. */
async function quietly(fn, mode = 'quiet') {
  const orig = [console.log, console.error, console.warn];
  console.log = console.error = console.warn = () => {};
  output.setMode(mode);
  try {
    return await fn();
  } finally {
    output.setMode('default');
    [console.log, console.error, console.warn] = orig;
  }
}

function runPair(tm) {
  return quietly(() => translateAndValidate([KEY], SOURCE, FR_PAIR, 'en:fr', { apiKey: 'k', tm, targetCode: 'fr' }));
}

describe('disguised echo — the feedback retry', () => {
  beforeEach(() => { EchoFake.calls = []; EchoFake.responses = []; });

  it('is refused once, retried with the reason, and the real translation is accepted and cached', async () => {
    const tm = { _meta: { version: 1 } };
    EchoFake.responses = [{ [KEY]: THANKS_ACCENTED }, { [KEY]: 'Merci beaucoup !' }];
    const r = await runPair(tm);
    assert.equal(EchoFake.calls.length, 2, 'initial ask + one feedback retry');
    const retryNote = EchoFake.calls[1].options.descriptions[KEY];
    assert.match(retryNote, /rejected by the quality gate: source echo/);
    assert.ok(retryNote.includes(THANKS_ACCENTED), 'the rejected value is quoted back');
    assert.deepEqual(r.translated, { [KEY]: 'Merci beaucoup !' });
    assert.equal(lookupTM(tm, THANKS, 'fr', FR_TM_KEY), 'Merci beaucoup !');
  });

  it('a model that keeps copying fails the key, and the copy is never cached', async () => {
    const tm = { _meta: { version: 1 } };
    EchoFake.responses = [{ [KEY]: THANKS_ACCENTED }, { [KEY]: 'Thank yoú very múch!' }];
    const r = await runPair(tm);
    assert.equal(r.translated, null);
    assert.equal(r.failures.length, 1);
    assert.equal(r.failures[0].disguisedEcho, true);
    assert.equal(r.failures[0].value, 'Thank yoú very múch!', 'the newer refusal is the one reported');
    assert.equal(lookupTM(tm, THANKS, 'fr', FR_TM_KEY), null);
  });

  it('a disguised copy an older gate let into the TM is evicted and healed in the same run', async () => {
    const tm = { _meta: { version: 1 } };
    storeTM(tm, THANKS, 'fr', FR_TM_KEY, THANKS_ACCENTED);
    EchoFake.responses = [{ [KEY]: 'Merci beaucoup !' }];
    const r = await runPair(tm);
    assert.equal(r.tmHitCount, 1);
    assert.equal(EchoFake.calls.length, 1, 'the evicted key is re-asked once (the retry round)');
    assert.deepEqual(r.translated, { [KEY]: 'Merci beaucoup !' });
    assert.equal(lookupTM(tm, THANKS, 'fr', FR_TM_KEY), 'Merci beaucoup !');
  });
});

// =================================================================
// 3 + 4. The fallback path and the no-translate exemption (real sync)
// =================================================================

function makeFake(name) {
  class Fake extends TranslationMethod {
    constructor() { super(name); }
    async translate(keys, sourceFlat) {
      Fake.batchCalls.push([...keys]);
      const out = {};
      for (const k of keys) {
        const v = Fake.keyBehavior(sourceFlat[k], k);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }
    estimateCost(keyCount) {
      return { estimatedCost: keyCount * 0, currency: 'USD', source: 'test' };
    }
  }
  Fake.reset = () => { Fake.batchCalls = []; Fake.keyBehavior = (src) => `FR:${src}`; };
  Fake.reset();
  METHOD_REGISTRY[name] = Fake;
  return Fake;
}

const Primary = makeFake('test-de-primary');
const Secondary = makeFake('test-de-secondary');

/** Sprinkle accents on vowels — the disguise this suite is about. */
const sprinkle = (s) => s.replace(/[aeiou]/g, (c) => ({ a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' })[c]);

function tempProject(config, source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-disguised-echo-'));
  fs.mkdirSync(path.join(dir, 'locales'));
  fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify(source, null, 2));
  fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
    inputLocale: 'en', localesDir: './locales', ...config,
  }, null, 2));
  return dir;
}

function quietSync(dir) {
  return quietly(() => runSync({ cwd: dir, cliArgs: { 'no-verify': true } }), 'json');
}

describe('disguised echo — fallback and no-translate, through a real sync', () => {
  let dir;
  beforeEach(() => { Primary.reset(); Secondary.reset(); });
  afterEach(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); dir = null; });

  it('what the primary keeps copying goes to the fallback, through the same gate', async () => {
    const pair = resolvePairs({
      inputLocale: 'en', model: 'm', defaultMethod: 'llm', resolvedLanguages: {},
      pairs: { 'en:fr': { method: 'test-de-primary', fallback: { method: 'test-de-secondary' } } },
    }).get('en:fr');
    Primary.keyBehavior = (src) => sprinkle(src);
    Secondary.keyBehavior = () => 'Merci beaucoup !';
    const tm = { _meta: { version: 1 } };
    const r = await quietly(() => translateWithFallback([KEY], SOURCE, pair, 'en:fr', { apiKey: null, tm, targetCode: 'fr' }));
    assert.equal(Primary.batchCalls.length, 2, 'the primary got its feedback retry first');
    assert.deepEqual(Secondary.batchCalls[0], [KEY]);
    assert.deepEqual(r.translated, { [KEY]: 'Merci beaucoup !' });
    assert.equal(lookupTM(tm, THANKS, 'fr', tmMethodKey(pair.fallback)), 'Merci beaucoup !');
    assert.equal(lookupTM(tm, THANKS, 'fr', tmMethodKey(pair)), null, 'the copy is cached nowhere');
  });

  it('a sync never writes a disguised copy: with no fallback the key stays failed', async () => {
    dir = tempProject({ languages: ['fr'], pairs: { 'en:fr': { method: 'test-de-primary' } } },
      { thanks: THANKS, save: 'Save' });
    Primary.keyBehavior = (src) => (src === THANKS ? sprinkle(src) : 'Enregistrer');
    const result = await quietSync(dir);
    const fr = JSON.parse(fs.readFileSync(path.join(dir, 'locales', 'fr.json'), 'utf-8'));
    assert.equal(fr.save, 'Enregistrer');
    assert.equal(fr.thanks, undefined, 'the disguised copy was not written');
    assert.equal(result.totalFailed, 1);
    const tm = JSON.parse(fs.readFileSync(path.join(dir, TM_DIR, TM_FILENAME), 'utf-8'));
    assert.ok(!JSON.stringify(tm).includes(sprinkle(THANKS)), 'and not cached');
  });

  it('a no-translate key never meets the check: its drifted value is restored verbatim, unbilled', async () => {
    const source = { tagline: THANKS, save: 'Save' };
    dir = tempProject({
      languages: ['fr'], noTranslate: ['tagline'],
      pairs: { 'en:fr': { method: 'test-de-primary' } },
    }, source);
    fs.writeFileSync(path.join(dir, 'locales', 'fr.json'),
      JSON.stringify({ tagline: THANKS_ACCENTED, save: 'Enregistrer' }, null, 2));
    await quietSync(dir);
    const fr = JSON.parse(fs.readFileSync(path.join(dir, 'locales', 'fr.json'), 'utf-8'));
    assert.equal(fr.tagline, THANKS, 'copied verbatim from the source');
    assert.ok(!Primary.batchCalls.flat().includes('tagline'), 'never sent to a method');
  });
});
