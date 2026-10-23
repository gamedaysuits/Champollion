/**
 * Round 4 building blocks, unit by unit (the personas drive them end to end
 * in round4-personas-e2e.test.js): the lock's per-locale record and its
 * backward compatibility, the queue planner's precedence (named redo >
 * pending retry > held back), hand-edit classification, the markup and
 * script checks, the different-inputs-same-output index, the per-branch
 * plural echo check, and the typeable gettext context separator.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readLock, readManifest, writeManifest, hashValue, LOCK_FILENAME } from '../lib/hash.js';
import {
  LockState, planQueue, createEditClassifier, encodeWritten, decodeWritten, shortSourceHash, refusedBy,
} from '../lib/locale-state.js';
import { diffLocale } from '../lib/diff.js';
import { GATE_VERSION } from '../lib/validate.js';
import { storeTM, tmMethodKey } from '../lib/tm.js';
import { checkMarkup, pluralBranchPairs } from '../lib/icu-structure.js';
import {
  validateTranslations, isLatinOnly, hasForeignFullwidthLatin, SharedOutputIndex, pluralBranchEcho,
} from '../lib/validate.js';
import { keysForNamespace, fromTypedContext } from '../lib/locale-layout.js';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'r4u-'));

describe('lock: version 1 stays readable, version 2 carries the per-locale record', () => {
  it('a v1 lock reads as its source map with no locale state; writing without state keeps v1', () => {
    const d = tmpDir();
    fs.writeFileSync(path.join(d, LOCK_FILENAME), JSON.stringify({ a: hashValue('A') }));
    assert.deepEqual(readLock(d).locales, {});
    assert.deepEqual(readManifest(d), { a: hashValue('A') });
    writeManifest(d, { a: hashValue('A'), b: hashValue('B') });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(d, LOCK_FILENAME), 'utf8')), { a: hashValue('A'), b: hashValue('B') });
  });

  it('with per-locale state it writes v2; a later source-only write (the Docusaurus path) keeps the state', () => {
    const d = tmpDir();
    writeManifest(d, { a: hashValue('A') }, { fr: { written: { a: encodeWritten('A', 'Ah') }, pending: {}, refused: {} } });
    const raw = JSON.parse(fs.readFileSync(path.join(d, LOCK_FILENAME), 'utf8'));
    assert.equal(raw.version, 2);
    assert.deepEqual(Object.keys(raw.locales.fr), ['written'], 'empty parts are not written');
    writeManifest(d, { a: hashValue('A2') });
    assert.equal(readLock(d).locales.fr.written.a, encodeWritten('A', 'Ah'));
    assert.deepEqual(readManifest(d), { a: hashValue('A2') });
  });

  it('a lock from a newer champollion fails loud', () => {
    const d = tmpDir();
    fs.writeFileSync(path.join(d, LOCK_FILENAME), JSON.stringify({ version: 9, source: {}, locales: {} }));
    assert.throws(() => readLock(d), /newer champollion/);
  });

  it('LockState.prune drops removed locales and keys; null keeps a locale untouched', () => {
    const s = new LockState({
      fr: { written: { a: '1', gone: '2' } }, de: { written: { a: '3' } }, xx: { written: { a: '4' } },
    });
    s.prune(new Map([['fr', new Set(['a'])], ['de', null]]));
    assert.deepEqual(Object.keys(s.toJSON()).sort(), ['de', 'fr']);
    assert.deepEqual(s.toJSON().fr.written, { a: '1' });
    assert.deepEqual(s.toJSON().de.written, { a: '3' });
  });

  it('written-records round-trip', () => {
    assert.deepEqual(decodeWritten(encodeWritten('Hello', 'Bonjour')), {
      source: shortSourceHash('Hello'), value: encodeWritten('x', 'Bonjour').split(':')[1],
    });
    assert.equal(decodeWritten('nonsense'), null);
  });
});

describe('hand-edit classification', () => {
  const pair = { target: 'fr', method: 'local', model: 'm' };
  it('record match → machine; record mismatch → edited, unless the cache holds that exact text', () => {
    const tm = { _meta: { version: 1 } };
    const classify = createEditClassifier({ tm, locale: 'fr', written: { k: encodeWritten('Hello', 'Bonjour') } });
    assert.equal(classify('k', 'k', 'Bonjour', 'Hello'), 'machine');
    assert.equal(classify('k', 'k', 'Salut à la main', 'Hello'), 'edited');
    storeTM(tm, 'Hello', 'fr', tmMethodKey(pair), 'Salut (old model)');
    assert.equal(createEditClassifier({ tm, locale: 'fr', written: { k: encodeWritten('Hello', 'Bonjour') } })('k', 'k', 'Salut (old model)', 'Hello'), 'machine');
  });
  it('no record: machine only with cache proof (for a changed source, any cached text of the locale)', () => {
    const tm = { _meta: { version: 1 } };
    storeTM(tm, 'Old source', 'fr', tmMethodKey(pair), 'Ancienne traduction');
    const classify = createEditClassifier({ tm, locale: 'fr', written: {} });
    assert.equal(classify('k', 'k', 'Ancienne traduction', 'New source', false), 'unknown');
    assert.equal(classify('k', 'k', 'Ancienne traduction', 'New source', true), 'machine');
    assert.equal(classify('k', 'k', 'Fait main', 'New source', true), 'unknown');
  });
});

describe('planQueue — precedence: named redo > pending retry > held back; bulk redos keep hand edits', () => {
  const pair = { target: 'fr', method: 'local', model: 'm' };
  const fallbackPair = { ...pair, fallback: { target: 'fr', method: 'local', model: 'fb' } };
  const src = { a: 'Alpha one two', b: 'Beta one two', c: 'Gamma one two' };
  const refusal = (key, methods, extra = {}) => ({ [key]: { source: shortSourceHash(src[key]), methods, on: '2026-10-03', gate: GATE_VERSION, ...extra } });
  const plan = (opts) => {
    const { forced = [], target = { a: 'A', b: 'B', c: 'C' }, written = {}, refused = {}, pending = {}, pairConfig = pair, named = [], bulk = false, fresh = false, missing = false } = opts;
    const t = missing ? {} : target;
    const diff = diffLocale(src, t, '[EN] ', [...forced, ...Object.keys(pending)], [], null, null);
    return planQueue({
      diff, sourceFlat: src, targetFlat: t, lockKeyOf: k => k,
      localeState: { written, pending, refused }, named: new Set(named), bulk, pending: new Set(Object.keys(pending)),
      fresh, pairConfig, classify: createEditClassifier({ tm: null, locale: 'fr', written }),
    });
  };
  const allWritten = Object.fromEntries(Object.keys(src).map(k => [k, encodeWritten(src[k], k.toUpperCase())]));

  it('a refused key queued for a plain reason is held; a fallback that has not refused it takes it', () => {
    const p = plan({ missing: true, refused: refusal('a', [tmMethodKey(pair)]) });
    assert.deepEqual(p.held, ['a']);
    const f = plan({ missing: true, refused: refusal('a', [tmMethodKey(pair)]), pairConfig: fallbackPair });
    assert.deepEqual([f.held, f.heldFromPrimary], [[], ['a']]);
  });
  it('a named or bulk redo and --fresh are never held', () => {
    const refused = refusal('a', [tmMethodKey(pair)]);
    assert.deepEqual(plan({ missing: true, refused, forced: ['a'], named: ['a'] }).held, []);
    assert.deepEqual(plan({ missing: true, refused, forced: ['a', 'b', 'c'], bulk: true }).held, []);
    assert.deepEqual(plan({ missing: true, refused, fresh: true }).held, []);
  });
  it('a pending key gets its one retry when the refusal came from the redo; after that it is held', () => {
    const viaRedo = plan({ written: allWritten, pending: { a: '--redo all' }, refused: refusal('a', [tmMethodKey(pair)], { redo: true }) });
    assert.deepEqual([viaRedo.pendingRetry, viaRedo.held, viaRedo.pendingAll], [['a'], [], ['a']]);
    const again = plan({ written: allWritten, pending: { a: '--redo all' }, refused: refusal('a', [tmMethodKey(pair)]) });
    assert.deepEqual([again.pendingRetry, again.held, again.pendingAll], [[], ['a'], ['a']], 'held, still bypassing the cache');
  });
  it('a refusal for the old source text does not hold the key', () => {
    const p = plan({ missing: true, refused: { a: { source: shortSourceHash('older text'), methods: [tmMethodKey(pair)] } } });
    assert.deepEqual(p.held, []);
  });
  it('bulk redo keeps hand edits; a named redo replaces them; a pending retry keeps them', () => {
    const written = { ...allWritten, b: encodeWritten(src.b, 'what sync wrote') }; // b was edited by hand since
    const bulk = plan({ written, forced: ['a', 'b', 'c'], bulk: true });
    assert.deepEqual(bulk.kept, ['b']);
    assert.deepEqual(bulk.toProcess.sort(), ['a', 'c']);
    const named = plan({ written, forced: ['b'], named: ['b'] });
    assert.deepEqual(named.replacing.map(r => [r.key, r.why]), [['b', 'named']]);
    const pending = plan({ written, pending: { b: '--redo all' } });
    assert.deepEqual(pending.kept, ['b']);
  });
  it('refusedBy matches the source text and method key', () => {
    const r = { source: shortSourceHash('x'), methods: ['m1'] };
    assert.equal(refusedBy(r, 'x', 'm1'), true);
    assert.equal(refusedBy(r, 'y', 'm1'), false);
    assert.equal(refusedBy(r, 'x', 'm2'), false);
  });
});

describe('checkMarkup — tags compared per name: open, close, nesting', () => {
  it('a lost closing tag, a dropped tag, a moved tag fail; reordered siblings and <br>/<br/> pass', () => {
    assert.match(checkMarkup('Please <strong>book</strong> now', 'Veuillez <strong>réserver').reason, /<\/strong> closes 0 time\(s\), 1 in the source/);
    assert.match(checkMarkup('Please <strong>book</strong> now', 'Veuillez réserver').reason, /<strong> is missing/);
    assert.match(checkMarkup('<b>A <i>x</i></b>', '<b>A</b> <i>x</i>').reason, /nest differently/);
    assert.equal(checkMarkup('<b>A</b> and <i>B</i>', '<i>B</i> et <b>A</b>'), null);
    assert.equal(checkMarkup('Line<br>two', 'Ligne<br/>deux'), null);
    assert.equal(checkMarkup('a < b > c', 'a < b > c'), null);
    assert.equal(checkMarkup('<0>Hello</0> world', '<0>Bonjour</0> le monde'), null);
  });
  it('per plural form: added categories repeat other\'s tags legitimately', () => {
    assert.equal(checkMarkup('{n, plural, one {<b>1</b> file} other {<b>#</b> files}}',
      '{n, plural, one {<b>1</b> файл} few {<b>#</b> файла} many {<b>#</b> файлов} other {<b>#</b> файла}}'), null);
    assert.match(checkMarkup('{n, plural, one {<b>1</b> file} other {<b>#</b> files}}',
      '{n, plural, one {<b>1</b> файл} few {<b>#</b> файла} many {<b># файлов} other {<b>#</b> файла}}').reason, /plural form "many"/);
  });
  it('the gate refuses it', () => {
    const { failures } = validateTranslations({ k: 'Veuillez <strong>réserver maintenant' }, { k: 'Please <strong>book</strong> now' }, { target: 'fr' });
    assert.equal(failures[0].markup, true);
  });
});

describe('script by Unicode script, not by byte', () => {
  it('accented and fullwidth Latin are Latin; mixed Cyrillic is not Latin-only; CJK keeps fullwidth', () => {
    assert.equal(isLatinOnly('Bóók án appointment'), true);
    assert.equal(isLatinOnly('Ｂｏｏｋ'), true);
    assert.equal(isLatinOnly('Войти через GitHub'), false);
    assert.equal(isLatinOnly('{n, plural, one {Один файл} other {%(count)d файлов}}'), false, 'ICU keywords are not prose');
    assert.equal(isLatinOnly('ＯＫ', 'ja'), false);
    assert.equal(hasForeignFullwidthLatin('Привет Ｗｏｒｌｄ', 'ru'), true);
    assert.equal(hasForeignFullwidthLatin('ＯＫです', 'ja'), false);
  });
  it('the gate refuses fullwidth English in a Russian value', () => {
    // (A fullwidth COPY of the source is already a disguised echo; this one is not a copy.)
    const { failures } = validateTranslations({ k: 'Ｂｏｏｋ ｎｏｗ ｐｌｅａｓｅ' }, { k: 'Book an appointment' }, { target: 'ru' });
    assert.match(failures[0].reason, /fullwidth Latin/);
    const copy = validateTranslations({ k: 'Ｂｏｏｋ ａｎ ａｐｐｏｉｎｔｍｅｎｔ' }, { k: 'Book an appointment' }, { target: 'ru' });
    assert.equal(copy.failures[0].disguisedEcho, true);
  });
});

describe('plural forms get the echo checks', () => {
  it('pairs each target branch with its source branch, or other for added categories', () => {
    assert.deepEqual(pluralBranchPairs('{n, plural, one {A} other {B}}', '{n, plural, one {a} few {b} other {c}}').map(p => [p.selector, p.source, p.translated]),
      [['one', 'A', 'a'], ['few', 'B', 'b'], ['other', 'B', 'c']]);
  });
  it('a disguised branch is refused; a short exact branch in a Latin target ("emails") passes', () => {
    assert.match(pluralBranchEcho('{n, plural, one {Book one appointment today} other {Book # appointments today}}',
      '{n, plural, one {Réserver un rendez-vous} other {Bóok # áppointments tódáy}}').reason, /plural form\(s\) "other"/);
    assert.equal(pluralBranchEcho('{n, plural, one {# email} other {# emails}}', '{n, plural, one {# courriel} other {# emails}}'), null);
  });
});

describe('SharedOutputIndex — different inputs, same output', () => {
  const SENTENCE = 'kiskinwahamâtowikamik nikî-wâpahtên ôma anohc';
  it('flags one multi-word output for 3+ different sources; synonyms and repeated sources pass', () => {
    const ix = new SharedOutputIndex();
    const s = ix.suspects([
      { key: 'a', source: 'School app', value: SENTENCE },
      { key: 'b', source: 'Contact the school', value: SENTENCE },
      { key: 'c', source: 'October newsletter', value: SENTENCE },
      { key: 'd', source: 'OK', value: "D'accord" }, { key: 'e', source: 'Okay', value: "D'accord" }, { key: 'f', source: 'Sure', value: "D'accord" },
      { key: 'g', source: 'Save', value: 'Enregistrer le document' }, { key: 'h', source: 'Save!', value: 'Enregistrer le document' },
      { key: 'i', source: 'save', value: 'Enregistrer le document' },
    ]);
    assert.deepEqual([...s.keys()].sort(), ['a', 'b', 'c']);
  });
  it('remembers accepted values across batches: a later repeat is caught, only the new key is suspect', () => {
    const ix = new SharedOutputIndex();
    ix.add([{ key: 'a', source: 'School app', value: SENTENCE }, { key: 'b', source: 'Contact the school', value: SENTENCE }]);
    const s = ix.suspects([{ key: 'content:news.md#1', source: 'October newsletter', value: SENTENCE }]);
    assert.deepEqual([...s.keys()], ['content:news.md#1']);
    assert.deepEqual([...ix.flagged.values()][0].keys.sort(), ['a', 'b', 'content:news.md#1']);
  });
  it('protected terms are never suspect', () => {
    const ix = new SharedOutputIndex({ protectedTerms: ['Springfield Elementary School District'] });
    const items = ['A b c', 'D e f', 'G h i'].map((source, i) => ({ key: `k${i}`, source, value: 'Springfield Elementary School District' }));
    assert.equal(ix.suspects(items).size, 0);
  });
});

describe('a gettext context key can be typed', () => {
  it('"\\x04" and "␄" both name msgctxt\\u0004msgid; namespaces are unaffected', () => {
    assert.equal(fromTypedContext('verb\\x04Open'), 'verb\u0004Open');
    assert.equal(fromTypedContext('verb␄Open'), 'verb\u0004Open');
    assert.deepEqual(keysForNamespace({ namespaced: true }, ['django::verb\\x04Open', 'other::x'], 'django'), ['verb\u0004Open']);
  });
});

describe('content blocks and front-matter fields join the locale\'s shared-output index', () => {
  const SENTENCE = 'kiskinwahamâtowikamik nikî-wâpahtên ôma anohc';
  it('a block repeating what two keys already got is refused: the fallback takes it, or the source text stands', async () => {
    const { translateBlocksWithFallback, translateFieldsWithFallback } = await import('../lib/fallback.js');
    const seeded = () => {
      const ix = new SharedOutputIndex();
      ix.add([{ key: 'title', source: 'School app', value: SENTENCE }, { key: 'contact', source: 'Contact the school', value: SENTENCE }]);
      return ix;
    };
    const missed = [{ seg: { text: '# October newsletter' }, source: '# October newsletter' }, { seg: { text: 'Welcome back.' }, source: 'Welcome back.' }];
    const pairConfig = { target: 'crk', method: 'local', model: 'nmt' };
    const runBatch = async (texts, cfg) => ({ blocks: texts.map(t => (cfg.model === 'fb' ? `FB ${t}` : (t.startsWith('#') ? SENTENCE : `OK ${t}`))), fellBack: [] });

    const alone = await translateBlocksWithFallback({ missed, blocks: new Map(), pairConfig, runBatch, fallbackPrefix: '[EN] ', sharedOutputs: seeded(), label: 'content:news.md' });
    assert.deepEqual(alone.sharedOutput, [0]);
    assert.equal(alone.outs[0], '# October newsletter', 'refused twice: the source text, unmarked');
    assert.equal(alone.outs[1], 'OK Welcome back.');
    assert.equal(alone.stores.length, 1, 'the refused block is never cached');

    const withFb = await translateBlocksWithFallback({
      missed, blocks: new Map(), pairConfig: { ...pairConfig, fallback: { target: 'crk', method: 'local', model: 'fb' } },
      runBatch, fallbackPrefix: '[EN] ', sharedOutputs: seeded(), label: 'content:news.md',
    });
    assert.equal(withFb.outs[0], 'FB # October newsletter');
    assert.equal(withFb.fromFallback, 1);

    const fields = await translateFieldsWithFallback({
      fields: { title: 'October newsletter' }, misses: ['title'], pairConfig, sharedOutputs: seeded(),
      translate: async () => ({ title: SENTENCE }),
    });
    assert.match(fields.hollowed[0].reason, /same output for 3 different source strings/);
  });
});
