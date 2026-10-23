/**
 * Round 3 synthetic-user fixes — the pieces underneath the end-to-end tests
 * in round3-personas-e2e.test.js: plural-gap retry and reporting, the po
 * "repeats other" marker, line-atomic progress on a terminal, the cache
 * change line, loopback pricing, and the model-switch count.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { translateAndValidate } from '../lib/translate-pair.js';
import { METHOD_REGISTRY } from '../lib/translate.js';
import { validateTranslations } from '../lib/validate.js';
import { pluralGaps } from '../lib/icu-structure.js';
import { writePO, poPluralFindings } from '../lib/po.js';
import { output, showKey } from '../lib/output.js';
import {
  storeTM, evictTM, tmMethodKey, describeTMChanges, findModelSwitchStrandedEntries, describeMethodKey,
} from '../lib/tm.js';
import { isLoopbackEndpoint } from '../lib/methods/http-utils.js';
import { reportGeneratedPluralKeys } from '../lib/sync.js';
import { expandPluralsForLocale } from '../lib/plurals.js';

// ── Scripted methods: one that reads per-key instructions (an LLM), one that
// does not (a machine translation engine).
class InstructedFake {
  constructor() { this.acceptsKeyInstructions = true; }
  async translate(keys, sourceFlat, pairConfig, options) {
    InstructedFake.calls.push({ keys: [...keys], descriptions: options.descriptions || {} });
    return InstructedFake.responses.shift() ?? null;
  }
}
class EngineFake {
  constructor() { this.acceptsKeyInstructions = false; }
  async translate(keys) {
    EngineFake.calls.push({ keys: [...keys] });
    return EngineFake.responses.shift() ?? null;
  }
}
METHOD_REGISTRY['r3-instructed'] = InstructedFake;
METHOD_REGISTRY['r3-engine'] = EngineFake;

const SRC = { files: '{n, plural, one {One file} other {%(count)d files}}' };
const RU_ONE_OTHER = '{n, plural, one {Один файл} other {%(count)d файлов}}';
const RU_FULL = '{n, plural, one {Один файл} few {%(count)d файла} many {%(count)d файлов} other {%(count)d файла}}';
const pair = (method) => ({ target: 'ru', method, name: 'Russian' });
const run = (method, tm = { _meta: { version: 1 } }) => translateAndValidate(['files'], SRC, pair(method), 'en:ru', {
  apiKey: 'k', tm, targetCode: 'ru',
});

describe('plural forms the model left out', () => {
  beforeEach(() => {
    InstructedFake.calls = []; InstructedFake.responses = [];
    EngineFake.calls = []; EngineFake.responses = [];
  });

  it('an LLM is asked once more, naming the missing forms; a second answer without them is accepted and reported', async () => {
    InstructedFake.responses = [{ files: RU_ONE_OTHER }, { files: RU_ONE_OTHER }];
    const r = await run('r3-instructed');
    assert.equal(InstructedFake.calls.length, 2);
    assert.match(InstructedFake.calls[1].descriptions.files, /no "few", "many" branch\. Russian uses few \(2, 3, 4\), many \(0, 5, 6\)/);
    assert.equal(r.translated.files, RU_ONE_OTHER, 'accepted as the model wrote it — no form made up');
    assert.deepEqual(r.pluralGaps.files.everyday, ['few', 'many']);
    assert.equal(r.failures.length, 0);
    assert.equal(r.sentCount, 1);
    assert.equal(r.retriedCount, 1);
  });

  it('the retry that supplies the forms wins, and nothing is reported', async () => {
    InstructedFake.responses = [{ files: RU_ONE_OTHER }, { files: RU_FULL }];
    const r = await run('r3-instructed');
    assert.equal(r.translated.files, RU_FULL);
    assert.deepEqual(r.pluralGaps, {});
  });

  it('a retry that returns nothing keeps the first (paid-for) answer', async () => {
    InstructedFake.responses = [{ files: RU_ONE_OTHER }, null];
    const r = await run('r3-instructed');
    assert.equal(r.translated.files, RU_ONE_OTHER);
    assert.ok(r.pluralGaps.files);
  });

  it('a retry refused for another reason (broken ICU) also keeps the first answer', async () => {
    InstructedFake.responses = [{ files: RU_ONE_OTHER }, { files: '{n, plúrál, one {Один} other {файлов}}' }];
    const r = await run('r3-instructed');
    assert.equal(r.translated.files, RU_ONE_OTHER);
    assert.equal(r.failures.length, 0);
  });

  it('a machine translation engine is not asked again (it cannot be told) — accepted and reported', async () => {
    EngineFake.responses = [{ files: RU_ONE_OTHER }];
    const r = await run('r3-engine');
    assert.equal(EngineFake.calls.length, 1);
    assert.equal(r.translated.files, RU_ONE_OTHER);
    assert.ok(r.pluralGaps.files);
  });

  it('a cached incomplete answer is served free (not re-asked every sync), and still reported', async () => {
    const tm = { _meta: { version: 1 } };
    storeTM(tm, SRC.files, 'ru', tmMethodKey(pair('r3-instructed')), RU_ONE_OTHER);
    const r = await run('r3-instructed', tm);
    assert.equal(InstructedFake.calls.length, 0);
    assert.equal(r.translated.files, RU_ONE_OTHER);
    assert.ok(r.pluralGaps.files);
  });
});

describe('pluralGaps', () => {
  const src = '{n, plural, one {One} other {# items}}';
  it('names everyday and rare categories separately', () => {
    assert.deepEqual(pluralGaps(src, '{n, plural, one {Un} other {# x}}', 'fr'), [{ name: 'n', type: 'cardinal', everyday: [], rare: ['many'] }]);
    assert.deepEqual(pluralGaps(src, RU_ONE_OTHER.replace('%(count)d', '#').replace('%(count)d', '#'), 'ru')[0].everyday, ['few', 'many']);
  });
  it('exact =N branches that cover every count of a category supply it', () => {
    assert.deepEqual(pluralGaps(src, '{n, plural, =0 {Aucun} =1 {Un} many {# de x} other {# x}}', 'fr'), []);
  });
  it('a count-agnostic source (only `other`) is not judged; a language with only `other` has no gap', () => {
    assert.deepEqual(pluralGaps('{n, plural, other {Items: #}}', '{n, plural, other {Элементов: #}}', 'ru'), []);
    assert.deepEqual(pluralGaps(src, '{n, plural, other {#件}}', 'ja'), []);
  });
});

describe('the gettext "repeats other" marker', () => {
  const SOURCE = 'msgid ""\nmsgstr ""\n"Language: en\\n"\n\n#, python-format\nmsgid "One file"\nmsgid_plural "%(count)d files"\nmsgstr[0] ""\nmsgstr[1] ""\n';
  it('marks the copied forms; verify finds them until a reviewer writes real ones', () => {
    const out = writePO({ flat: { 'One file': RU_ONE_OTHER }, sourceText: SOURCE, targetText: null, locale: 'ru' });
    assert.match(out, /^# champollion: plural form\(s\) few \(msgstr\[1\]\), many \(msgstr\[2\]\)/m);
    assert.deepEqual(poPluralFindings(out, { locale: 'ru' }).copied, [{ key: 'One file', categories: ['few', 'many'] }]);
    const reviewed = out.replace('msgstr[1] "%(count)d файлов"', 'msgstr[1] "%(count)d файла"');
    assert.deepEqual(poPluralFindings(reviewed, { locale: 'ru' }).copied, [], 'real forms written: no longer a finding');
  });
  it('a re-translation with every form drops the marker', () => {
    const first = writePO({ flat: { 'One file': RU_ONE_OTHER }, sourceText: SOURCE, targetText: null, locale: 'ru' });
    const second = writePO({ flat: { 'One file': RU_FULL }, sourceText: SOURCE, targetText: first, locale: 'ru' });
    assert.doesNotMatch(second, /# champollion:/);
  });
  it("Django's Russian fraction form takes `other` by right — not marked as a copy", () => {
    const target = 'msgid ""\nmsgstr ""\n"Language: ru\\n"\n"Plural-Forms: nplurals=4; plural=(n%1 != 0 ? 3 : n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<12 || n%100>14) ? 1 : 2);\\n"\n';
    const out = writePO({ flat: { 'One file': RU_FULL }, sourceText: SOURCE, targetText: target, locale: 'ru' });
    assert.doesNotMatch(out, /# champollion:/);
  });
});

describe('i18next forms the source has no key for', () => {
  it('with an engine that takes no instructions, sync warns that the value is the "other" form', () => {
    const expansion = expandPluralsForLocale({ items_one: '{{count}} item', items_other: '{{count}} items' }, 'en', 'fr');
    const lines = [];
    const orig = console.error;
    console.error = (m) => lines.push(m);
    try {
      reportGeneratedPluralKeys({ keys: Object.keys(expansion.flat), expansion, filename: 'fr.json',
        pairConfig: { method: 'deepl', name: 'French', target: 'fr' }, code: 'fr', sourceLocale: 'en' });
    } finally {
      console.error = orig;
    }
    assert.match(lines.join('\n'), /items_many — "many" is a French plural form\(s\) the en source has no key for, translated from the "_other" text by deepl, which cannot be told which plural form to write/);
  });
});

describe('quality gate length boundary (hospital persona)', () => {
  it('exactly 4× the source passes; more fails — matching the documented "exceeds"', () => {
    const pc = { target: 'fr', name: 'French' };
    const source = 'One dose'; // 8 chars
    const at = 'Une seule dose, une fois'.padEnd(32, '.'); // 32 chars = 4.0×
    assert.equal(at.length / source.length, 4);
    assert.ok(validateTranslations({ k: at }, { k: source }, pc).validated.k);
    const over = `${at}!`;
    assert.match(validateTranslations({ k: over }, { k: source }, pc).failures[0].reason, /length inflation/);
  });
});

describe('line-atomic progress on a terminal', () => {
  let writes;
  let origWrite;
  let origLog;
  let origErr;
  let origTTY;
  beforeEach(() => {
    writes = [];
    origWrite = process.stdout.write;
    origLog = console.log;
    origErr = console.error;
    origTTY = process.stdout.isTTY;
    process.stdout.write = (s) => { writes.push(String(s)); return true; };
    console.log = (s) => writes.push(`${s}\n`);
    console.error = (s) => writes.push(`${s}\n`);
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    output.setMode('default');
  });
  afterEach(() => {
    process.stdout.write = origWrite;
    console.log = origLog;
    console.error = origErr;
    Object.defineProperty(process.stdout, 'isTTY', { value: origTTY, configurable: true });
  });

  it('a bar is redrawn in place for its own file, and ended before any other line', () => {
    output.progressBar(1, 4, { item: 'fr.json' });
    output.progressBar(2, 4, { item: 'fr.json' });
    output.info('de.json — 3 missing');
    output.progressBar(1, 2, { item: 'de.json' });
    output.progressDone('fr.json', '[OK]');
    const text = writes.join('');
    const lines = text.split('\n');
    // Every [INFO] starts its own line; no line holds two items' output.
    for (const line of lines) {
      assert.doesNotMatch(line, /\S\[INFO\]/);
      assert.ok(!(line.includes('fr.json') && line.includes('de.json')), JSON.stringify(line));
    }
    assert.match(text, /\r {5}fr\.json █+░+ 2\/4 keys\n\[INFO\] de\.json/);
    assert.match(text, /de\.json █+░+ 1\/2 keys\n {5}fr\.json \[OK\]\n$/);
  });

  it('[OK] joins its own bar when that bar is still the open line', () => {
    output.progressBar(2, 2, { item: 'fr.json' });
    output.progressDone('fr.json', '[OK]');
    assert.match(writes.join(''), /fr\.json █+ 2\/2 keys \[OK\]\n$/);
  });

  it('keys are printed with ␄, never U+0004', () => {
    output.warn('key "verb\u0004Open" not translated');
    assert.match(writes.join(''), /verb␄Open/);
    assert.equal(showKey('a\u0004b'), 'a␄b');
  });
});

describe('cache and cost details', () => {
  it('describeTMChanges says what was added, replaced and removed', () => {
    const tm = { _meta: { version: 1 } };
    storeTM(tm, 'a', 'fr', 'm', 'A');
    storeTM(tm, 'b', 'fr', 'm', 'B');
    storeTM(tm, 'a', 'fr', 'm', 'A2');
    storeTM(tm, 'b', 'fr', 'm', 'B');
    evictTM(tm, 'b', 'fr', 'm');
    assert.equal(describeTMChanges(tm), '1 entries — 2 added, 1 replaced with a new translation, 1 re-translated to the same text, 1 removed');
  });

  it('describeMethodKey puts the cache key in words', () => {
    assert.equal(describeMethodKey('local|stub-1|formal-vous|'), 'local · model stub-1 · register formal-vous');
    assert.equal(describeMethodKey('llm'), 'llm');
  });

  it('the model-switch count covers only current source strings — and accepts an iterator', () => {
    const tm = { _meta: { version: 1 } };
    const oldPair = { target: 'fr', method: 'local', model: 'old' };
    const newPair = { target: 'fr', method: 'local', model: 'new' };
    for (const t of ['kept 1', 'kept 2', 'kept 3', 'edited away', 'deleted']) storeTM(tm, t, 'fr', tmMethodKey(oldPair), `FR ${t}`);
    const pairs = new Map([['en:fr', newPair]]);
    assert.equal(findModelSwitchStrandedEntries(tm, pairs.values())[0].stranded[0].count, 5);
    const [r] = findModelSwitchStrandedEntries(tm, pairs.values(), { sourceTexts: ['kept 1', 'kept 2', 'kept 3', 'new text'] });
    assert.equal(r.stranded[0].count, 3);
  });

  it('isLoopbackEndpoint follows the harness rule', () => {
    for (const u of ['http://localhost:11434/v1', 'http://127.0.0.1:8080', 'http://[::1]:9', 'http://0.0.0.0:1', 'http://app.localhost/x', 'unix:/tmp/s']) {
      assert.equal(isLoopbackEndpoint(u), true, u);
    }
    for (const u of ['http://192.168.1.5/v1', 'https://api.groq.com/openai/v1', 'http://10.0.0.1', '', null]) {
      assert.equal(isLoopbackEndpoint(u), false, String(u));
    }
  });
});
