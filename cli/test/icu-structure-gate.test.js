/**
 * ICU MessageFormat structure: the quality gate, verify, integrity, and the
 * Translation Memory — what a translation may and may not change.
 *
 * THE FINDINGS THIS ENCODES (synthetic users, 2026-10):
 *   (b) next-intl: an ICU plural came back as
 *       "{cóúnt, plúrál, óné {# event this week} óthér …}". The gate passed
 *       it, sync wrote it, locked it and stored it in the Translation
 *       Memory; `verify` caught it afterwards, but `sync --force-keys
 *       Home.items` re-served the same broken text from the TM for $0.
 *   (c) post-sync verification ignored --pair: a French-only run reported
 *       Spanish errors.
 *
 * THE RULE (lib/icu-structure.js): only the text inside the branches may
 * change. Variable names, the plural/select keywords, selectors, `#` and
 * printf conversions are code. A plural may ADD the CLDR categories the
 * target language uses (French `many`, Polish `few`/`many`).
 *
 * Run: node --test test/icu-structure-gate.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { checkICUStructure, parseMessage, icuGuidance, printfConversions } from '../lib/icu-structure.js';
import { validateTranslations } from '../lib/validate.js';
import { translateAndValidate } from '../lib/translate-pair.js';
import { METHOD_REGISTRY } from '../lib/translate.js';
import { TranslationMethod } from '../lib/methods/base.js';
import { loadTM, saveTM, storeTM, lookupTM, tmMethodKey, cacheKey } from '../lib/tm.js';
import { tmSourceText, createTMEvictor } from '../lib/tm-evict.js';
import { runSync } from '../lib/sync.js';
import { resolveConfig } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';
import { verifyLocales, localesForPairFlag } from '../lib/verify.js';
import { auditLocalePair, findICUStructureIssues, formatIntegrityReport } from '../lib/integrity.js';
import { run as runIntegrity } from '../lib/commands/integrity.js';
import { output } from '../lib/output.js';

const SOURCE = '{count, plural, one {# event this week} other {# events this week}}';
const MANGLED = '{cóúnt, plúrál, óné {# event this week} óthér {# events this week}}';
const GOOD_FR = '{count, plural, one {# événement cette semaine} other {# événements cette semaine}}';

// -----------------------------------------------------------------
// The structural rule
// -----------------------------------------------------------------
describe('checkICUStructure — what a translation may change', () => {
  const pass = (locale, source, translated) => {
    const r = checkICUStructure(source, translated, locale);
    assert.equal(r, null, `expected PASS for ${locale}: ${translated}\n${r?.reason}`);
  };
  const fail = (locale, source, translated, re) => {
    const r = checkICUStructure(source, translated, locale);
    assert.ok(r, `expected FAIL for ${locale}: ${translated}`);
    assert.match(r.reason, re);
    return r;
  };

  it('the exact mangled next-intl value fails, naming every damaged keyword', () => {
    const r = fail('fr', SOURCE, MANGLED, /ICU keyword 'other' was translated to 'óthér'/);
    assert.match(r.reason, /ICU variable 'count' was translated to 'cóúnt'/);
    assert.match(r.reason, /ICU keyword 'plural' was translated to 'plúrál'/);
    assert.match(r.reason, /ICU keyword 'one' was translated to 'óné'/);
  });

  it('translating only the branch text passes', () => {
    pass('fr', SOURCE, GOOD_FR);
    pass('de', '{gender, select, male {He} female {She} other {They}} liked it',
      '{gender, select, male {Ihm} female {Ihr} other {Ihnen}} gefiel es');
  });

  it('a plural may ADD the target language\'s CLDR categories — French many, Polish few/many', () => {
    pass('fr', SOURCE, '{count, plural, one {# événement} many {# d’événements} other {# événements}}');
    pass('pl', SOURCE, '{count, plural, one {# wydarzenie} few {# wydarzenia} many {# wydarzeń} other {# wydarzenia}}');
    pass('ar', SOURCE, '{count, plural, zero {لا أحداث} one {حدث واحد} two {حدثان} few {# أحداث} many {# حدثًا} other {# حدث}}');
  });

  it('…but not a category the language does not have', () => {
    fail('fr', SOURCE, '{count, plural, one {# événement} few {# événements} other {# événements}}',
      /'few' is not one of the plural categories of fr \(one, many, other\)/);
  });

  it('a source category the target language does not use may be dropped (Japanese has only other)', () => {
    pass('ja', SOURCE, '{count, plural, other {今週のイベント#件}}');
    fail('fr', SOURCE, '{count, plural, other {# événements}}', /selector 'one' of 'count' was removed/);
  });

  it('exact selectors (=0) are kept, and may be added', () => {
    const src = '{count, plural, =0 {No events} one {# event} other {# events}}';
    pass('fr', src, '{count, plural, =0 {Aucun événement} one {# événement} other {# événements}}');
    fail('fr', src, '{count, plural, one {# événement} other {# événements}}', /selector '=0' of 'count' was removed/);
    pass('fr', SOURCE, '{count, plural, =0 {Aucun événement} one {# événement} other {# événements}}');
  });

  it('`other` can never be dropped', () => {
    fail('fr', SOURCE, '{count, plural, one {# événement}}', /selector 'other' of 'count' was removed/);
  });

  it('select options are code: translated or extra options fail', () => {
    const src = '{gender, select, male {He} female {She} other {They}}';
    fail('fr', src, '{gender, select, homme {Il} femme {Elle} other {Iel}}',
      /ICU keyword 'male' was translated to 'homme'/);
    fail('fr', src, '{genre, sélectionner, male {Il} female {Elle} other {Iel}}',
      /ICU variable 'gender' was translated to 'genre'.*ICU keyword 'select' was translated to 'sélectionner'/);
  });

  it('nested structure is compared branch by branch', () => {
    const src = '{gender, select, female {{count, plural, one {She has # cat} other {She has # cats}}} other {{count, plural, one {They have # cat} other {They have # cats}}}}';
    pass('fr', src, '{gender, select, female {{count, plural, one {Elle a # chat} other {Elle a # chats}}} other {{count, plural, one {Iel a # chat} other {Iel a # chats}}}}');
    fail('fr', src, '{gender, select, female {{count, plural, one {Elle a # chat} autre {Elle a # chats}}} other {{count, plural, one {Iel a # chat} other {Iel a # chats}}}}',
      /ICU keyword 'other' was translated to 'autre'/);
  });

  it('# stays in plural branches (a language may spell zero/one/two/=N as a word)', () => {
    pass('fr', SOURCE, '{count, plural, one {un événement cette semaine} other {# événements cette semaine}}');
    fail('fr', SOURCE, '{count, plural, one {# événement} other {des événements}}',
      /# is missing from the 'other' branch/);
  });

  it('selectordinal uses the target\'s ORDINAL categories', () => {
    const src = 'You finished {pos, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}';
    pass('fr', src, 'Vous avez fini {pos, selectordinal, one {#er} other {#e}}');
    fail('fr', src, 'Vous avez fini {pos, selectordinal, one {#er} many {#e} other {#e}}',
      /'many' is not one of the ordinal categories of fr \(one, other\)/);
  });

  it('a changed argument type, an offset change or broken syntax fails', () => {
    fail('fr', SOURCE, '{count, select, one {# événement} other {# événements}}', /changed from plural to select/);
    fail('fr', '{count, plural, offset:1 one {# other} other {# others}}',
      '{count, plural, one {# autre} other {# autres}}', /offset/);
    fail('fr', SOURCE, '{count, plural, one {# événement} other {# événements}', /ICU syntax broken/);
  });

  it('simple placeholders survive — Flutter / next-intl {name}', () => {
    pass('fr', 'Hello {name}!', 'Bonjour {name} !');
    fail('fr', 'Hello {name}!', 'Bonjour {nom} !', /placeholder \{name\} was changed to \{nom\}/);
    fail('fr', 'Hello {name}!', 'Bonjour !', /placeholder \{name\} is missing/);
    fail('fr', 'Total: {price, number}', 'Total : {price}', /placeholder \{price, number\} was changed to \{price\}/);
  });

  it('apostrophes: French elision before a placeholder is fine (Flutter reads \' literally)', () => {
    pass('fr', 'Profile of {name}', "Profil d'{name}");
    pass('fr', "Use '{' to open", "Utilisez '{' pour ouvrir");
  });

  it('values that are not ICU messages are left alone', () => {
    assert.equal(checkICUStructure('Hello {{name}}', 'Bonjour {{nom}}', 'fr'), null, 'i18next {{…}} is not ICU');
    assert.equal(checkICUStructure('{{ .Count }} items', '{{ .Count }} articles', 'fr'), null, 'Hugo');
    assert.equal(checkICUStructure('Plain text', 'Texte simple', 'fr'), null);
  });

  it('printf conversions (gettext) are code too; repeated in added plural forms is fine', () => {
    fail('fr', 'Delete %d files from %s?', 'Supprimer %d fichiers ?', /printf placeholder %s is missing/);
    pass('fr', 'Delete %1$d files from %2$s?', 'Supprimer de %2$s %1$d fichiers ?');
    pass('fr', 'Save 50% now', 'Économisez 50 % maintenant');
    pass('ru', '{n, plural, one {One file} other {%(count)d files}}',
      '{n, plural, one {%(count)d файл} few {%(count)d файла} many {%(count)d файлов} other {%(count)d файла}}');
    fail('ru', '{n, plural, one {One file} other {%(count)d files}}',
      '{n, plural, one {# файл} few {%(count)d файла} many {%(count)d файлов} other {%(count)d файла}}',
      /'#' in the 'one' branch .* keep those instead of #/);
    assert.deepEqual(printfConversions('%(name)s has %d new %i, 100%% sure'), ['%(name)s', '%d', '%d']);
  });

  it('the parser resolves ICU quoting and keeps raw branch text', () => {
    const p = parseMessage("It''s '{'literal'}' {x}");
    assert.equal(p.ok, true);
    assert.equal(p.nodes[0].value, "It's {literal} ");
    const q = parseMessage('{n, plural, one {a {b} c} other {d}}', { apostrophes: 'literal' });
    assert.equal(q.nodes[0].options[0].raw, 'a {b} c');
  });

  it('prompt guidance names the syntax and the target language\'s categories, with counts', () => {
    const g = icuGuidance(SOURCE, 'ru', 'Russian');
    assert.match(g, /variable name\(s\) "count"/);
    assert.match(g, /Russian plural categories \(CLDR\): one \(1, 21, 31\), few \(2, 3, 4\), many \(0, 5, 6\), other/);
    assert.equal(icuGuidance('Hello {name}', 'ru', 'Russian'), null, 'simple placeholders need no plural guidance');
  });
});

// -----------------------------------------------------------------
// The quality gate
// -----------------------------------------------------------------
describe('quality gate — ICU structure damage fails validation', () => {
  it('rejects the mangled value with a precise, flagged reason; accepts the good one', () => {
    const { validated, failures } = validateTranslations(
      { bad: MANGLED, good: GOOD_FR }, { bad: SOURCE, good: SOURCE }, { target: 'fr' });
    assert.deepEqual(Object.keys(validated), ['good']);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].key, 'bad');
    assert.equal(failures[0].icu, true);
    assert.match(failures[0].reason, /ICU keyword 'other' was translated to 'óthér'/);
  });

  it('accepts a legit added French many category', () => {
    const fr = '{count, plural, one {# événement} many {# d’événements} other {# événements}}';
    const { validated } = validateTranslations({ k: fr }, { k: SOURCE }, { target: 'fr' });
    assert.equal(validated.k, fr);
  });
});

// -----------------------------------------------------------------
// translateAndValidate: retry with the reason, TM eviction of the serving entry
// -----------------------------------------------------------------
class ScriptedICU extends TranslationMethod {
  constructor() { super('test-icu-scripted'); }
  async translate(keys, sourceFlat, pairConfig, options) {
    ScriptedICU.calls.push({ keys: [...keys], descriptions: options.descriptions || null, target: pairConfig.target });
    const next = ScriptedICU.responder;
    return next ? next(keys, sourceFlat, pairConfig, ScriptedICU.calls.length) : null;
  }
}
ScriptedICU.calls = [];
ScriptedICU.responder = null;
METHOD_REGISTRY['test-icu-scripted'] = ScriptedICU;

describe('translateAndValidate — ICU damage gets one precise retry; the TM never keeps it', () => {
  const PAIR = { target: 'fr', method: 'test-icu-scripted', model: 'model-b', name: 'French', register: 'neutral' };
  beforeEach(() => { ScriptedICU.calls = []; ScriptedICU.responder = null; output.setMode('quiet'); });
  afterEach(() => output.setMode('default'));

  it('first answer mangled → retry told exactly what broke → good answer validated and cached', async () => {
    ScriptedICU.responder = (keys, src, pc, n) => (n === 1 ? { 'Home.items': MANGLED } : { 'Home.items': GOOD_FR });
    const tm = { _meta: { version: 1 } };
    const r = await translateAndValidate(['Home.items'], { 'Home.items': SOURCE }, PAIR, 'en:fr', {
      apiKey: 'k', tm, targetCode: 'fr',
    });
    assert.deepEqual(r.translated, { 'Home.items': GOOD_FR });
    assert.equal(ScriptedICU.calls.length, 2);
    assert.match(ScriptedICU.calls[0].descriptions['Home.items'], /French plural categories \(CLDR\)/,
      'the first prompt already explains the ICU syntax');
    assert.match(ScriptedICU.calls[1].descriptions['Home.items'], /RETRY: .*ICU keyword 'other' was translated to 'óthér'/);
    assert.equal(lookupTM(tm, SOURCE, 'fr', tmMethodKey(PAIR)), GOOD_FR);
  });

  it('mangled twice → the key fails, nothing written to the TM', async () => {
    ScriptedICU.responder = () => ({ 'Home.items': MANGLED });
    const tm = { _meta: { version: 1 } };
    const r = await translateAndValidate(['Home.items'], { 'Home.items': SOURCE }, PAIR, 'en:fr', {
      apiKey: 'k', tm, targetCode: 'fr',
    });
    assert.equal(r.translated, null);
    assert.equal(r.failures.length, 1);
    assert.equal(lookupTM(tm, SOURCE, 'fr', tmMethodKey(PAIR)), null);
  });

  it('a damaged hit CARRIED from another model is evicted where it lives, then re-translated', async () => {
    const tm = { _meta: { version: 1 } };
    const otherModelKey = tmMethodKey({ ...PAIR, model: 'model-a' });
    storeTM(tm, SOURCE, 'fr', otherModelKey, MANGLED);
    ScriptedICU.responder = () => ({ 'Home.items': GOOD_FR });
    const r = await translateAndValidate(['Home.items'], { 'Home.items': SOURCE }, PAIR, 'en:fr', {
      apiKey: 'k', tm, targetCode: 'fr',
    });
    assert.deepEqual(r.translated, { 'Home.items': GOOD_FR });
    assert.equal(tm[cacheKey(SOURCE, 'fr', otherModelKey)], undefined, 'the other model\'s damaged entry is gone');
    assert.equal(ScriptedICU.calls.length, 1, 'the method was consulted');
  });

  it('keys the model must not see (gettext context, newlines) travel under aliases', async () => {
    const key = 'verb\u0004Open';
    ScriptedICU.responder = (keys, src) => Object.fromEntries(keys.map(k => [k, `Ouvrir:${src[k]}`]));
    const tm = { _meta: { version: 1 } };
    const r = await translateAndValidate([key, 'nav.home'], { [key]: 'Open', 'nav.home': 'Home page' }, PAIR, 'en:fr', {
      apiKey: 'k', tm, targetCode: 'fr', descriptions: { [key]: 'Context (msgctxt): verb' },
    });
    assert.deepEqual(ScriptedICU.calls[0].keys, ['msg_1', 'nav.home']);
    assert.equal(ScriptedICU.calls[0].descriptions.msg_1, 'Context (msgctxt): verb');
    assert.deepEqual(r.translated, { [key]: 'Ouvrir:Open', 'nav.home': 'Ouvrir:Home page' });
    // Cached under the context-folded text, so "Open" (adjective) never shares it.
    assert.equal(lookupTM(tm, tmSourceText(key, 'Open'), 'fr', tmMethodKey(PAIR)), 'Ouvrir:Open');
    assert.equal(lookupTM(tm, 'Open', 'fr', tmMethodKey(PAIR)), null);
  });
});

describe('tm-evict — only the entry that produced the damaged value', () => {
  it('evicts every method key holding exactly that text, nothing else', () => {
    const tm = { _meta: { version: 1 } };
    storeTM(tm, SOURCE, 'fr', 'llm|a||', MANGLED);
    storeTM(tm, SOURCE, 'fr', 'llm|b||', MANGLED);
    storeTM(tm, SOURCE, 'fr', 'llm|c||', GOOD_FR);
    storeTM(tm, SOURCE, 'de', 'llm|a||', MANGLED);
    const n = createTMEvictor(tm).evictProducing(SOURCE, 'fr', MANGLED);
    assert.equal(n, 2);
    assert.equal(lookupTM(tm, SOURCE, 'fr', 'llm|c||'), GOOD_FR, 'a different (good) text is kept');
    assert.equal(lookupTM(tm, SOURCE, 'de', 'llm|a||'), MANGLED, 'other locales are untouched');
  });
});

// -----------------------------------------------------------------
// Project-level: verify / integrity / sync --force-keys / --pair
// -----------------------------------------------------------------
describe('next-intl project — written ICU damage is reported and leaves the cache', () => {
  let dir;
  let logLines;
  let origLog;
  let origErr;
  let origWrite;
  let savedKey;

  const writeJSON = (rel, data) => {
    const p = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  };
  const readJSON = (rel) => JSON.parse(fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf-8'));
  const pairFor = (code) => resolvePairs(resolveConfig({}, dir)).get(`en:${code}`);

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-icu-gate-'));
    writeJSON('messages/en.json', { Home: { title: 'Upcoming events', items: SOURCE } });
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesDir: './messages', defaultMethod: 'test-icu-scripted',
      languages: ['fr', 'es'],
    }, null, 2));
    ScriptedICU.calls = [];
    ScriptedICU.responder = (keys, src, pc) => Object.fromEntries(keys.map(k => [k,
      k === 'Home.items'
        ? (pc.target === 'fr' ? GOOD_FR : '{count, plural, one {# evento esta semana} other {# eventos esta semana}}')
        : `${pc.target}: ${src[k]} ✓`]));
    savedKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    logLines = [];
    origLog = console.log;
    origErr = console.error;
    origWrite = process.stdout.write.bind(process.stdout);
    console.log = (...a) => logLines.push(a.join(' '));
    console.error = (...a) => logLines.push(a.join(' '));
    process.stdout.write = () => true;
    output.setMode('default');
  });

  afterEach(() => {
    console.log = origLog;
    console.error = origErr;
    process.stdout.write = origWrite;
    output.setMode('default');
    if (savedKey !== undefined) process.env.OPENROUTER_API_KEY = savedKey;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** An older pipeline wrote the mangled value AND cached it. */
  async function seedDamage() {
    const r = await runSync({ cwd: dir, cliArgs: {} });
    assert.equal(r.totalFailed, 0);
    assert.equal(r.verifyErrors, 0);
    const fr = readJSON('messages/fr.json');
    fr.Home.items = MANGLED;
    writeJSON('messages/fr.json', fr);
    const tm = loadTM(dir);
    storeTM(tm, SOURCE, 'fr', tmMethodKey(pairFor('fr')), MANGLED);
    saveTM(dir, tm);
  }

  it('verify reports the damage as an ICU structure error and evicts the cached copy', async () => {
    await seedDamage();
    const v = await verifyLocales(resolveConfig({}, dir), dir);
    assert.ok(v.errors >= 1);
    assert.equal(v.tmEvicted, 1);
    assert.ok(logLines.some(l => /\[VERIFY\] fr: 1 ICU structure error\(s\): Home\.items \(ICU variable 'count' was translated to 'cóúnt'\)/.test(l)),
      logLines.join('\n'));
    assert.equal(lookupTM(loadTM(dir), SOURCE, 'fr', tmMethodKey(pairFor('fr'))), null, 'evicted on disk');
  });

  it('after verify, sync --force-keys re-translates (the method is called) instead of re-serving the damage', async () => {
    await seedDamage();
    await verifyLocales(resolveConfig({}, dir), dir);
    ScriptedICU.calls = [];
    const r = await runSync({ cwd: dir, cliArgs: { 'force-keys': 'Home.items', pair: 'en:fr' } });
    assert.equal(r.totalFailed, 0);
    assert.equal(r.verifyErrors, 0);
    assert.ok(ScriptedICU.calls.some(c => c.target === 'fr' && c.keys.includes('Home.items')),
      'the translation method was consulted for the forced key');
    assert.equal(readJSON('messages/fr.json').Home.items, GOOD_FR);
  });

  it('even without verify, --force-keys never re-serves it: the gate refuses the cached copy and evicts it', async () => {
    await seedDamage();
    ScriptedICU.calls = [];
    const r = await runSync({ cwd: dir, cliArgs: { 'force-keys': 'Home.items', pair: 'en:fr', 'no-verify': true } });
    assert.equal(r.totalFailed, 0);
    assert.ok(ScriptedICU.calls.some(c => c.keys.includes('Home.items')));
    assert.equal(readJSON('messages/fr.json').Home.items, GOOD_FR);
    assert.equal(lookupTM(loadTM(dir), SOURCE, 'fr', tmMethodKey(pairFor('fr'))), GOOD_FR);
  });

  it('a hand-written damaged value (no equal cache entry) is reported but its cache entry is NOT evicted', async () => {
    await runSync({ cwd: dir, cliArgs: {} });
    const fr = readJSON('messages/fr.json');
    fr.Home.items = '{count, plural, one {# événement} autre {# événements}}';
    writeJSON('messages/fr.json', fr);
    const v = await verifyLocales(resolveConfig({}, dir), dir);
    assert.ok(v.errors >= 1);
    assert.equal(v.tmEvicted, undefined);
    assert.equal(lookupTM(loadTM(dir), SOURCE, 'fr', tmMethodKey(pairFor('fr'))), GOOD_FR,
      'the pipeline\'s own (good) translation stays cached');
  });

  it('integrity reports it (exit 1, icuIssues in --json) and evicts the cached copy', async () => {
    await seedDamage();
    logLines = [];
    const code = await runIntegrity({ json: true }, dir);
    assert.equal(code, 1);
    const report = JSON.parse(logLines.join('\n'));
    const fr = report.locales.find(l => l.locale === 'fr');
    assert.equal(fr.issues.icuIssues.length, 1);
    assert.equal(fr.issues.icuIssues[0].key, 'Home.items');
    assert.equal(report.tmEvicted, 1);
    assert.equal(lookupTM(loadTM(dir), SOURCE, 'fr', tmMethodKey(pairFor('fr'))), null);
  });

  it('the integrity report section names the damage', () => {
    const audit = auditLocalePair({ k: SOURCE }, { k: MANGLED }, 'fr');
    assert.equal(audit.icuIssues.length, 1);
    const text = formatIntegrityReport('fr', audit);
    assert.match(text, /ICU STRUCTURE DAMAGE \(1\)/);
    assert.match(text, /ICU keyword 'other' was translated to 'óthér'/);
    assert.deepEqual(findICUStructureIssues({ k: SOURCE }, { k: GOOD_FR }, 'fr'), []);
  });

  it('post-sync verification honors --pair: a French-only run does not report Spanish damage', async () => {
    await runSync({ cwd: dir, cliArgs: {} });
    const es = readJSON('messages/es.json');
    es.Home.items = '{cuenta, plural, uno {# evento} otro {# eventos}}';
    writeJSON('messages/es.json', es);
    const fr = readJSON('messages/fr.json');
    delete fr.Home.title;
    writeJSON('messages/fr.json', fr);

    logLines = [];
    const scoped = await runSync({ cwd: dir, cliArgs: { pair: 'en:fr' } });
    assert.equal(scoped.verifyErrors, 0, logLines.join('\n'));
    assert.ok(!logLines.some(l => /\[VERIFY\] es:/.test(l)), 'Spanish is not verified on a French-only run');

    logLines = [];
    const all = await runSync({ cwd: dir, cliArgs: {} });
    assert.ok(all.verifyErrors >= 1, 'an unscoped run still verifies Spanish');
    assert.ok(logLines.some(l => /\[VERIFY\] es: .*ICU structure error/.test(l)), logLines.join('\n'));
  });

  it('verifyLocales({ locales }) and localesForPairFlag scope a standalone verify', async () => {
    await runSync({ cwd: dir, cliArgs: {} });
    const es = readJSON('messages/es.json');
    es.Home.items = '{cuenta, plural, uno {# evento} otro {# eventos}}';
    writeJSON('messages/es.json', es);
    const config = resolveConfig({}, dir);
    assert.deepEqual(localesForPairFlag(config, 'en:fr'), ['fr']);
    assert.throws(() => localesForPairFlag(config, 'en:xx'), /UNKNOWN PAIR/);
    assert.equal((await verifyLocales(config, dir, { locales: ['fr'] })).errors, 0);
    assert.ok((await verifyLocales(config, dir, { locales: ['es'] })).errors >= 1);
  });
});
