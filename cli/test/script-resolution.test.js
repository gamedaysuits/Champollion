#!/usr/bin/env node
/**
 * Script conversion: choose-or-decline, transliteration fallbacks, repair.
 *
 * THE INCIDENT THIS ENCODES (downstream tester, curtisforbes.com):
 *   Script conversion used to be unconditional — every tlh / x-elvish-s /
 *   x-kryptonian project had its translations rewritten into Private Use
 *   Area codepoints. pIqaD, Tengwar and Kryptonian are NOT in Unicode, so
 *   PUA renders as nothing without a purpose-built font; the tester's site
 *   ships Latin-transliteration fonts and displayed blank strings. The
 *   converters also passed through letters they could not map (Klingon
 *   romanization has no d,c,f,g,i,k,s,x,z), leaving 129 keys half pIqaD,
 *   half Latin. One v0.2.0 --no-tm run mass-converted 119 more keys via the
 *   echo-requeue path.
 *
 * THE MODEL 0.3.0 PINS:
 *   - PUA display scripts default OFF; `script: "Piqd"` opts in.
 *   - Dual REAL orthographies (crk SRO/Syllabics, sr Latin/Cyrillic) have
 *     NO default: the config must choose — a community's writing system is
 *     not ours to pick. Translation refuses until it does.
 *   - `scriptFallback` wires user-declared transliteration rules; residual
 *     unmapped letters keep the whole value in the working script (warned,
 *     never failed — a failure would retry forever on unmappable jargon).
 *   - `repair-script` reverses the damage; `integrity` fails on it.
 *
 * Run: node --test test/script-resolution.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  resolveTargetScript,
  converterKeyForLocale,
  formatScriptChoiceError,
  validateScriptFallback,
  applyScriptFallback,
  unmappedLetters,
  reverseScript,
  isPrivateUse,
  convertScript,
  romanizationToPiqad,
  SCRIPT_CONVERTERS,
} from '../lib/scripts.js';
import { resolvePairs } from '../lib/pairs.js';
import { getLanguageCard } from '../lib/registers.js';
import { findUnexpectedPua } from '../lib/integrity.js';
import { runRepairScript } from '../lib/repair-script.js';
import { runSync } from '../lib/sync.js';
import { output } from '../lib/output.js';

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

const card = (code) => getLanguageCard(code);

// -----------------------------------------------------------------
// Resolution matrix
// -----------------------------------------------------------------
describe('resolveTargetScript — the choose-or-decline policy', () => {
  it('PUA converters default to the working script (only renderable-without-font choice)', () => {
    for (const code of ['tlh', 'x-elvish-s', 'x-kryptonian']) {
      const r = resolveTargetScript(code, {}, card(code));
      assert.equal(r.source, 'default', code);
      assert.equal(r.script, 'Latn', code);
      assert.equal(r.converterKey, null, `${code} must NOT convert by default`);
    }
  });

  it('config opt-in turns conversion on', () => {
    assert.equal(resolveTargetScript('tlh', { script: 'Piqd' }, card('tlh')).converterKey, 'tlh');
    assert.equal(resolveTargetScript('x-elvish-s', { script: 'Teng' }, card('x-elvish-s')).converterKey, 'x-elvish-s');
  });

  it('ISO codes are case-normalized — docs said "cans" for years', () => {
    for (const spelling of ['Cans', 'cans', 'CANS', 'cANS']) {
      const r = resolveTargetScript('crk', { script: spelling }, card('crk'));
      assert.equal(r.script, 'Cans', spelling);
      assert.equal(r.converterKey, 'crk', spelling);
    }
  });

  it('legacy word aliases throw with the exact rename hint', () => {
    assert.throws(
      () => resolveTargetScript('crk', { script: 'syllabics' }, card('crk')),
      /Use "Cans"/,
    );
    assert.throws(
      () => resolveTargetScript('tlh', { script: 'piqad' }, card('tlh')),
      /Use "Piqd"/,
    );
  });

  it('dual REAL orthographies require the choice — no default, both options named', () => {
    for (const [code, scripts] of [['crk', ['Latn', 'Cans']], ['sr', ['Latn', 'Cyrl']]]) {
      const r = resolveTargetScript(code, {}, card(code));
      assert.equal(r.source, 'choice-required', code);
      assert.equal(r.converterKey, null);
      assert.deepEqual(r.choices.map(c => c.script), scripts, code);
      const msg = formatScriptChoiceError(code, r);
      for (const s of scripts) assert.ok(msg.includes(`"${s}"`), `${code} message names ${s}`);
      assert.match(msg, /will not pick one/, 'the refusal states its reason');
    }
  });

  it('an explicit choice resolves crk and sr, through the card converter key', () => {
    assert.equal(resolveTargetScript('crk', { script: 'Cans' }, card('crk')).converterKey, 'crk');
    assert.equal(resolveTargetScript('crk', { script: 'Latn' }, card('crk')).converterKey, null);
    // srp's converter is registered under "sr" — the card's scriptConverter
    // field is the join, so the canonical code works too.
    assert.equal(resolveTargetScript('srp', { script: 'Cyrl' }, card('srp')).converterKey, 'sr');
    assert.equal(resolveTargetScript('sr', { script: 'Latn' }, card('sr')).converterKey, null);
  });

  it('the x-kryptonian escape hatch works on its own locale and throws on any other', () => {
    const r = resolveTargetScript('x-kryptonian', { script: 'x-kryptonian' }, card('x-kryptonian'));
    assert.equal(r.converterKey, 'x-kryptonian');
    assert.throws(
      () => resolveTargetScript('tlh', { script: 'x-kryptonian' }, card('tlh')),
      /belongs to the x-kryptonian locale/,
    );
  });

  it('a script the locale cannot produce throws, naming what it can', () => {
    assert.throws(
      () => resolveTargetScript('tlh', { script: 'Cyrl' }, card('tlh')),
      (e) => /not a script this locale can produce/.test(e.message)
        && /"Latn"/.test(e.message) && /"Piqd"/.test(e.message),
    );
  });

  it('locales without a converter are untouched — no default, no noise', () => {
    const r = resolveTargetScript('fr', {}, card('fr'));
    assert.equal(r.source, 'none');
    assert.equal(r.converterKey, null);
  });

  it('garbage and non-string values fail loud', () => {
    assert.throws(() => resolveTargetScript('tlh', { script: 'blorp' }, card('tlh')), /not an ISO 15924 code/);
    assert.throws(() => resolveTargetScript('tlh', { script: 42 }, card('tlh')), /expected an ISO 15924 code string/);
  });

  it('converterKeyForLocale resolves srp→"sr" via the card, and unknowns to null', () => {
    assert.equal(converterKeyForLocale('srp', card('srp')), 'sr');
    assert.equal(converterKeyForLocale('sr', card('sr')), 'sr');
    assert.equal(converterKeyForLocale('tlh', card('tlh')), 'tlh');
    assert.equal(converterKeyForLocale('fr', card('fr')), null);
  });
});

// -----------------------------------------------------------------
// resolvePairs integration
// -----------------------------------------------------------------
describe('resolvePairs — resolution attached at pair-graph build', () => {
  it('attaches the resolution to every pair', () => {
    const pairs = resolvePairs({
      inputLocale: 'en',
      resolvedLanguages: { tlh: { name: 'Klingon', register: 'Formal.' } },
    });
    const r = pairs.get('en:tlh').scriptResolution;
    assert.equal(r.source, 'default');
    assert.equal(r.converterKey, null);
  });

  it('a per-pair script override beats the per-language value', () => {
    const pairs = resolvePairs({
      inputLocale: 'en',
      resolvedLanguages: { tlh: { name: 'Klingon', register: 'Formal.' } },
      pairs: { 'en:tlh': { script: 'Piqd' } },
    });
    assert.equal(pairs.get('en:tlh').scriptResolution.converterKey, 'tlh');
  });

  it('an invalid script fails at pair build with the pair named', () => {
    assert.throws(
      () => resolvePairs({
        inputLocale: 'en',
        resolvedLanguages: { tlh: { name: 'Klingon', register: 'Formal.', script: 'blorp' } },
      }),
      /en:tlh: Invalid "script"/,
    );
  });

  it('a scriptFallback on a converterless locale fails loud, not silently dead', () => {
    assert.throws(
      () => resolvePairs({
        inputLocale: 'en',
        resolvedLanguages: { fr: { name: 'French', register: 'Formal.', scriptFallback: { d: 'D' } } },
      }),
      /en:fr: "scriptFallback" has no effect/,
    );
  });
});

// -----------------------------------------------------------------
// Transliteration fallbacks
// -----------------------------------------------------------------
describe('scriptFallback — user-declared transliteration rules', () => {
  it('accepts rules whose replacements are fully mapped', () => {
    assert.doesNotThrow(() => validateScriptFallback({ d: 'D', c: 'ch', f: 'p' }, 'tlh'));
  });

  it('rejects a replacement the converter cannot map — a fallback must not move the hole', () => {
    assert.throws(
      () => validateScriptFallback({ z: 'zz' }, 'tlh'),
      (e) => /"z" → "zz"/.test(e.message) && /cannot map/.test(e.message),
    );
  });

  it('rejects non-object maps and empty entries', () => {
    assert.throws(() => validateScriptFallback(['d'], 'tlh'), /must be an object/);
    assert.throws(() => validateScriptFallback({ d: '' }, 'tlh'), /non-empty string/);
    assert.throws(() => validateScriptFallback({ '': 'D' }, 'tlh'), /empty-string key/);
  });

  it('applies longest key first and converts clean through the normal table', () => {
    // "ck" must win over "c"+"k".
    assert.equal(applyScriptFallback('ack', { c: 'ch', ck: 'q', k: 'q' }), 'aq');
    // A fallback-prepared Klingon string converts with zero unmapped letters.
    const prepared = applyScriptFallback('dab', { d: 'D' });
    assert.equal(prepared, 'Dab');
    assert.deepEqual(unmappedLetters(prepared, 'tlh'), []);
    const { unmapped } = convertScript(prepared, 'tlh');
    assert.deepEqual(unmapped, []);
  });

  it('substitution is textual — a rule can strand a letter, and the backstop still reports it', () => {
    // {c: "ch"} applied to literal "ch" produces "chh": the digraph consumes
    // c+h and the second h (not a Klingon letter alone) is stranded. The
    // fallback layer does not guess intent; the unmapped check catches what
    // remains, so a half-thought rule degrades to a warning, never to mixed
    // script on disk.
    const prepared = applyScriptFallback('dach', { d: 'D', c: 'ch' });
    assert.equal(prepared, 'Dachh');
    assert.deepEqual(unmappedLetters(prepared, 'tlh'), ['h']);
  });
});

// -----------------------------------------------------------------
// Coverage + reversal primitives
// -----------------------------------------------------------------
describe('unmappedLetters / reverseScript', () => {
  it('reports exactly the letters Klingon romanization lacks', () => {
    // "GitHub" — G maps (gh? no: G alone is not in the map; the tester's
    // repo showed d,c,f,g,i,k,s,x,z as the gaps).
    const letters = unmappedLetters('discord', 'tlh');
    assert.ok(letters.includes('d'), 'd is not Klingon');
    assert.ok(letters.includes('s'), 's is not Klingon');
    assert.ok(letters.includes('c'), 'c alone is not Klingon (only ch)');
  });

  it('never reports digits, whitespace or punctuation', () => {
    assert.deepEqual(unmappedLetters("tlhIngan 42 · Hol!", 'tlh'), []);
  });

  it('pIqaD reversal is an exact round-trip, curly apostrophe included', () => {
    const source = "tlhIngan Hol 'ej Qapla'";
    const pIqaD = romanizationToPiqad(source);
    assert.notEqual(pIqaD, source);
    const { reversed, caseLossy, unreversed } = reverseScript(pIqaD, 'tlh');
    assert.equal(reversed, source);
    assert.equal(caseLossy, false);
    assert.deepEqual(unreversed, []);
    // Curly apostrophe converts to the same codepoint and restores as '.
    const curly = romanizationToPiqad('Qapla’');
    assert.equal(reverseScript(curly, 'tlh').reversed, "Qapla'");
  });

  it('Kryptonian reversal restores letters but flags case loss', () => {
    const { converted } = convertScript('Hello', 'x-kryptonian');
    const { reversed, caseLossy } = reverseScript(converted, 'x-kryptonian');
    assert.equal(reversed, 'HELLO');
    assert.equal(caseLossy, true);
  });

  it('foreign PUA is left alone and reported, never invented a reading', () => {
    // U+E500 belongs to no registered converter.
    const { reversed, unreversed } = reverseScript('abc', 'tlh');
    assert.equal(reversed, 'abc');
    assert.deepEqual(unreversed, ['']);
  });

  it('isPrivateUse covers the BMP block and both supplementary planes', () => {
    assert.equal(isPrivateUse(0xE000), true);
    assert.equal(isPrivateUse(0xF8FF), true);
    assert.equal(isPrivateUse(0xF0000), true);
    assert.equal(isPrivateUse(0x100000), true);
    assert.equal(isPrivateUse(0x1400), false, 'Cree Syllabics is REAL Unicode, not PUA');
    assert.equal(isPrivateUse(0x0442), false, 'Cyrillic is real Unicode');
  });
});

// -----------------------------------------------------------------
// integrity: unexpected PUA
// -----------------------------------------------------------------
describe('findUnexpectedPua', () => {
  it('flags PUA when conversion is off, pointing at repair-script', () => {
    const findings = findUnexpectedPua(
      { title: '' },
      { locale: 'tlh', converts: false },
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].reason, /repair-script/);
    assert.match(findings[0].reason, /renders blank/);
  });

  it('stays quiet when conversion is opted in, or with no expectation', () => {
    assert.deepEqual(findUnexpectedPua({ t: '' }, { locale: 'tlh', converts: true }), []);
    assert.deepEqual(findUnexpectedPua({ t: '' }, null), []);
  });

  it('does not flag real non-Latin Unicode', () => {
    assert.deepEqual(
      findUnexpectedPua({ t: 'ᒥᓯᐘᐢᑯᐦᑖᐣ входит' }, { locale: 'crk', converts: false }),
      [],
    );
  });
});

// -----------------------------------------------------------------
// Hermetic sync e2e — stubbed fetch, google-translate method
// -----------------------------------------------------------------
describe('sync e2e — conversion is opt-in and unmapped letters never mix scripts', () => {
  let dir;
  let localesDir;
  let originalFetch;
  let savedGoogleKey;
  let savedOpenRouterKey;
  let fetchCount;
  let origWrite;

  // Valid Klingon romanization the stub returns for each source key.
  const KLINGON = {
    'Hello there': "nuqneH jup",
    'Doing things with logic': "meqmo' vay' vIta'",
    'Contact us': "nuvpu' tI'ang",
  };
  const EN = { greeting: 'Hello there', method: 'Doing things with logic', contact: 'Contact us' };

  const writeConfig = (extra = {}) => {
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3,
      inputLocale: 'en',
      localesDir: './locales',
      defaultMethod: 'google-translate',
      languages: { tlh: { ...extra } },
    }, null, 2));
  };

  const readTlh = () => JSON.parse(fs.readFileSync(path.join(localesDir, 'tlh.json'), 'utf-8'));
  const puaCount = (s) => [...JSON.stringify(s)].filter(ch => isPrivateUse(ch.codePointAt(0))).length;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-script-'));
    localesDir = path.join(dir, 'locales');
    fs.mkdirSync(localesDir);
    fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify(EN, null, 2));
    writeConfig();

    savedGoogleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    savedOpenRouterKey = process.env.OPENROUTER_API_KEY;
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test-key';
    delete process.env.OPENROUTER_API_KEY;

    fetchCount = 0;
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      fetchCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { translations: body.q.map(t => ({ translatedText: KLINGON[t] ?? `tlh(${t})` })) },
        }),
      };
    };

    output.setMode('quiet');
    origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.stdout.write = origWrite;
    output.setMode('default');
    if (savedGoogleKey === undefined) delete process.env.GOOGLE_TRANSLATE_API_KEY;
    else process.env.GOOGLE_TRANSLATE_API_KEY = savedGoogleKey;
    if (savedOpenRouterKey !== undefined) process.env.OPENROUTER_API_KEY = savedOpenRouterKey;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('default: romanization on disk, zero PUA — the tester\'s bug is gone', async () => {
    const result = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(result.totalFailed, 0);
    const tlh = readTlh();
    assert.equal(tlh.greeting, KLINGON['Hello there']);
    assert.equal(puaCount(tlh), 0, 'no PUA may reach disk without opt-in');
  });

  it('opt-in script:"Piqd": PUA written for clean values', async () => {
    writeConfig({ script: 'Piqd' });
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    const tlh = readTlh();
    assert.ok(puaCount(tlh.greeting) > 0, 'conversion opted in — pIqaD expected');
    assert.equal(tlh.greeting, romanizationToPiqad(KLINGON['Hello there']));
  });

  it('opted-in + unmapped letters: whole value stays romanization, run stays green, no requeue', async () => {
    // "GitHub Discord" carries letters Klingon lacks (i, s, c, d...).
    fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify({
      clean: 'Hello there',
      jargon: 'Join us',
    }, null, 2));
    KLINGON['Join us'] = 'GitHub Discord boQwI\'';   // model output with foreign letters
    writeConfig({ script: 'Piqd' });

    const result = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(result.totalFailed, 0, 'kept-romanization is NOT a failure');
    assert.equal(result.totalKeptWorkingScript, 1);

    const tlh = readTlh();
    assert.equal(puaCount(tlh.clean) > 0, true, 'clean value converted');
    assert.equal(tlh.jargon, "GitHub Discord boQwI'", 'unmapped value kept WHOLE in romanization — never mixed');

    // The anti-retry-forever invariant: a second sync has nothing to do.
    const callsBefore = fetchCount;
    const second = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(fetchCount, callsBefore, 'no API call on the second run');
    assert.equal(second.totalProcessed, 0, 'the kept key must not requeue');
  });

  it('scriptFallback maps the letters and the value converts clean', async () => {
    fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify({ k: 'Join us' }, null, 2));
    KLINGON['Join us'] = 'dab maH';   // d is not Klingon; b, a, m, H are
    writeConfig({ script: 'Piqd', scriptFallback: { d: 'D' } });

    const result = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(result.totalKeptWorkingScript, 0, 'fallback resolved every letter');
    assert.equal(readTlh().k, romanizationToPiqad('Dab maH'));
  });

  it('crk without a script choice refuses to sync, naming both orthographies', async () => {
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesDir: './locales',
      defaultMethod: 'google-translate', languages: ['crk'],
    }, null, 2));
    await assert.rejects(
      () => runSync({ cwd: dir, cliArgs: {} }),
      (e) => /ORTHOGRAPHY CHOICE REQUIRED/.test(e.message)
        && /"script": "Latn"/.test(e.message)
        && /"script": "Cans"/.test(e.message),
    );
  });

  it('--no-tm echo-requeue is byte-identical under the default — the +119 incident is benign', async () => {
    // Seed a locale where a key legitimately echoes its source (proper noun).
    fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify({ brand: 'Qapla Corp Hello' }, null, 2));
    KLINGON['Qapla Corp Hello'] = 'Qapla Corp Hello';   // model echoes (long enough to gate? 16 chars, ascii — echo exemption is ≤30 ascii, passes)
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    const before = JSON.stringify(readTlh());

    // --no-tm disables echo suppression: the key re-translates AND flows
    // through the conversion block again. Under unconditional conversion
    // this is the path that converted 119 extra keys in one run.
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true, 'no-tm': true } });
    assert.equal(JSON.stringify(readTlh()), before, 'byte-identical — nothing converted');
  });
});

// -----------------------------------------------------------------
// repair-script e2e
// -----------------------------------------------------------------
describe('repair-script — reverses the shipped damage', () => {
  let dir;
  let localesDir;
  let origWrite;

  const ROMAN = "tlhIngan Hol jatlh";
  const MIXED_SOURCE = 'maH GitHub';   // partially convertible

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-repair-'));
    localesDir = path.join(dir, 'locales');
    fs.mkdirSync(localesDir);
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesDir: './locales',
      languages: ['tlh', 'x-kryptonian'],
    }, null, 2));
    fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify({
      a: 'one', b: 'two', c: 'three',
    }, null, 2));

    // Seed the tester's three damage shapes:
    fs.writeFileSync(path.join(localesDir, 'tlh.json'), JSON.stringify({
      a: romanizationToPiqad(ROMAN),                    // pure PUA
      b: convertScript(MIXED_SOURCE, 'tlh').converted,  // mixed pIqaD + Latin passthrough
      c: 'untouched latin value',                       // healthy — must not change
    }, null, 2));
    fs.writeFileSync(path.join(localesDir, 'x-kryptonian.json'), JSON.stringify({
      a: convertScript('Hello', 'x-kryptonian').converted,
    }, null, 2));

    output.setMode('quiet');
    origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
  });

  afterEach(() => {
    process.stdout.write = origWrite;
    output.setMode('default');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const readLocale = (code) => JSON.parse(fs.readFileSync(path.join(localesDir, `${code}.json`), 'utf-8'));

  it('--dry previews and writes nothing', () => {
    const before = fs.readFileSync(path.join(localesDir, 'tlh.json'), 'utf-8');
    const result = runRepairScript({ cwd: dir, cliArgs: { dry: true } });
    assert.equal(result.dry, true);
    assert.equal(result.totals.valuesRepaired, 3, 'preview counts all repairs');
    assert.equal(fs.readFileSync(path.join(localesDir, 'tlh.json'), 'utf-8'), before, 'dry run must not write');
  });

  it('restores romanization exactly (tlh) and flags case loss (kryptonian)', () => {
    const result = runRepairScript({ cwd: dir, cliArgs: {} });
    assert.equal(result.exitCode, 0);

    const tlh = readLocale('tlh');
    assert.equal(tlh.a, ROMAN, 'pure PUA restored byte-exactly');
    assert.equal(tlh.b, 'maH GitHub', 'mixed value made whole again');
    assert.equal(tlh.c, 'untouched latin value', 'healthy values never touched');

    assert.equal(readLocale('x-kryptonian').a, 'HELLO', 'kryptonian restores uppercased');
    const kry = result.locales.find(l => l.locale === 'x-kryptonian');
    assert.equal(kry.files[0].caseLossy, 1, 'case loss is reported, not silent');
  });

  it('--locale filters; foreign PUA exits 1', () => {
    runRepairScript({ cwd: dir, cliArgs: { locale: 'tlh' } });
    assert.match(readLocale('x-kryptonian').a, /[-]/, 'other locale untouched under --locale');

    // Foreign PUA the converter does not own → left in place, exit 1.
    fs.writeFileSync(path.join(localesDir, 'tlh.json'), JSON.stringify({ a: 'bad' }, null, 2));
    const result = runRepairScript({ cwd: dir, cliArgs: { locale: 'tlh' } });
    assert.equal(result.exitCode, 1, 'unreversible PUA means the file still cannot render');
  });

  it('skips a locale whose conversion is opted in — there PUA is the deliverable', () => {
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesDir: './locales',
      languages: { tlh: { script: 'Piqd' } },
    }, null, 2));
    const result = runRepairScript({ cwd: dir, cliArgs: {} });
    const tlh = result.locales.find(l => l.locale === 'tlh');
    assert.match(tlh.skipped, /conversion enabled/);
    assert.match(readLocale('tlh').a, /[-]/, 'file untouched');
  });

  it('repairs Docusaurus i18n trees, message fields only by construction', () => {
    fs.rmSync(path.join(dir, 'champollion.config.json'));
    fs.writeFileSync(path.join(dir, 'docusaurus.config.js'), 'module.exports = {};\n');
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesDir: './i18n', languages: ['tlh'],
    }, null, 2));
    const tlhDir = path.join(dir, 'i18n', 'tlh');
    fs.mkdirSync(tlhDir, { recursive: true });
    fs.writeFileSync(path.join(tlhDir, 'code.json'), JSON.stringify({
      'nav.title': { message: romanizationToPiqad(ROMAN), description: 'The site title' },
    }, null, 2));

    const result = runRepairScript({ cwd: dir, cliArgs: {} });
    assert.equal(result.totals.valuesRepaired, 1);
    const repaired = JSON.parse(fs.readFileSync(path.join(tlhDir, 'code.json'), 'utf-8'));
    assert.equal(repaired['nav.title'].message, ROMAN);
    assert.equal(repaired['nav.title'].description, 'The site title', 'descriptions untouched');
  });
});

// -----------------------------------------------------------------
// integrity CLI e2e — the vendored site's build gate
// -----------------------------------------------------------------
describe('integrity — unexpected PUA fails the build until repaired', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-int-pua-'));
    fs.mkdirSync(path.join(dir, 'locales'));
    fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify({ title: 'Hello world' }, null, 2));
    fs.writeFileSync(path.join(dir, 'locales', 'tlh.json'), JSON.stringify({
      title: romanizationToPiqad('nuqneH qoH'),
    }, null, 2));
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesDir: './locales', languages: ['tlh'],
    }, null, 2));
  });

  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const runCLI = (args) => {
    try {
      const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], {
        cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { stdout, stderr: '', status: 0 };
    } catch (err) {
      return { stdout: err.stdout || '', stderr: err.stderr || '', status: err.status ?? 1 };
    }
  };

  it('exits 1 on PUA with conversion off, naming the repair', () => {
    const res = runCLI(['integrity']);
    assert.equal(res.status, 1);
    assert.match(res.stdout, /UNEXPECTED PUA/);
    assert.match(res.stdout, /repair-script/);
  });

  it('goes quiet once the script is opted in — the check is not vacuous', () => {
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesDir: './locales',
      languages: { tlh: { script: 'Piqd' } },
    }, null, 2));
    const res = runCLI(['integrity']);
    assert.doesNotMatch(res.stdout, /UNEXPECTED PUA/);
  });

  it('repair-script then integrity: the loop closes green', () => {
    const repair = runCLI(['repair-script']);
    assert.equal(repair.status, 0, repair.stdout + repair.stderr);
    const res = runCLI(['integrity']);
    assert.doesNotMatch(res.stdout, /UNEXPECTED PUA/);
  });
});
