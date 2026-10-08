/**
 * Flutter (.arb) and gettext (.po) beyond sync itself: `init` detection,
 * the help text, `verify --pair`, target auto-detection, the gettext
 * context in the Translation Memory (sync's echo check, the cost estimate),
 * XLIFF round trips of context keys, and `wrap` refusing both formats.
 *
 * THE RULE THESE ENCODE: a Flutter or Django project runs
 * `champollion init --yes --langs …` and gets a config `sync` accepts —
 * `localesPattern`, the template's source locale, empty target files of the
 * right shape — with no hand edits.
 *
 * Run: node --test test/init-document-formats.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { detectLocaleSetup, describeLocaleSetupHint, parseLanguageInput } from '../lib/commands/init.js';
import { run as runInit } from '../lib/commands/init.js';
import { run as runVerify } from '../lib/commands/verify.js';
import { run as runXliff } from '../lib/commands/xliff.js';
import { run as runWrap } from '../lib/commands/wrap.js';
import { COMMAND_HELP } from '../lib/command-help.js';
import { resolveConfig, autoDetectLanguages } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';
import { runSync } from '../lib/sync.js';
import { printCostEstimate } from '../lib/cost-report.js';
import { discoverLocaleLayout, loadSourceUnits } from '../lib/locale-layout.js';
import { encodeUnitId, decodeUnitId, exportXLIFF, importXLIFF } from '../lib/xliff.js';
import { addKeysToLocales, wrapUnsupportedReason } from '../lib/autofix.js';
import { readPO } from '../lib/po.js';
import { METHOD_REGISTRY } from '../lib/translate.js';
import { TranslationMethod } from '../lib/methods/base.js';
import { output } from '../lib/output.js';

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');
const C = '\u0004';

let dir;
let logLines;
let origLog;
let origErr;
let origWrite;
let savedKeys;

function put(rel, content) {
  const p = path.join(dir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  return p;
}
const read = (rel) => fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf-8');
const readConfig = () => JSON.parse(read('champollion.config.json'));

const EN_ARB = {
  '@@locale': 'en',
  hello: 'Hello {name}',
  '@hello': { placeholders: { name: { type: 'String' } } },
};

const EN_PO = `msgid ""
msgstr ""
"Language: en\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

#: app/views.py:3
msgid "Hello"
msgstr ""

msgctxt "verb"
msgid "Open"
msgstr ""

msgctxt "adjective"
msgid "Open"
msgstr ""

msgctxt "brand"
msgid "Champollion"
msgstr ""

msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] ""
msgstr[1] ""
`;

const FR_PO = `msgid ""
msgstr ""
"Language: fr\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n > 1);\\n"
`;

function flutterProject({ l10nYaml = true, template = 'app_en.arb' } = {}) {
  put('pubspec.yaml', 'name: demo\ndependencies:\n  flutter:\n    sdk: flutter\nflutter:\n  generate: true\n');
  if (l10nYaml) put('l10n.yaml', `arb-dir: lib/l10n\ntemplate-arb-file: ${template}\noutput-localization-file: app_localizations.dart\n`);
  put(`lib/l10n/${template}`, EN_ARB);
}

function djangoProject({ source = true } = {}) {
  put('manage.py', '#!/usr/bin/env python\n');
  if (source) put('locale/en/LC_MESSAGES/django.po', EN_PO);
  put('locale/fr/LC_MESSAGES/django.po', FR_PO);
}

/** Scripted stand-in for a translation model — what the run asked for is recorded. */
class FakeDocModel extends TranslationMethod {
  constructor() { super('test-doc-formats'); }
  async translate(keys, sourceFlat, pairConfig, options) {
    FakeDocModel.calls.push({ keys: [...keys], target: pairConfig.target });
    const out = {};
    for (const k of keys) {
      const src = sourceFlat[k];
      const ctx = options.descriptions?.[k] || '';
      if (src.startsWith('{n, plural')) out[k] = '{n, plural, one {Un fichier} other {%(count)d fichiers}}';
      else if (src === 'Champollion') out[k] = 'Champollion'; // a name: kept as written
      else if (src === 'Open') out[k] = /verb/.test(ctx) ? 'Ouvrir' : 'Ouvert';
      else out[k] = `${pairConfig.target}⟨${src}⟩`;
    }
    return out;
  }
}
FakeDocModel.calls = [];
METHOD_REGISTRY['test-doc-formats'] = FakeDocModel;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-docfmt-'));
  FakeDocModel.calls = [];
  savedKeys = { o: process.env.OPENROUTER_API_KEY };
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
  if (savedKeys.o !== undefined) process.env.OPENROUTER_API_KEY = savedKeys.o;
  fs.rmSync(dir, { recursive: true, force: true });
});

// -----------------------------------------------------------------
// init — Flutter
// -----------------------------------------------------------------
describe('init — a Flutter project (pubspec.yaml + l10n.yaml)', () => {
  it('detects the gen-l10n layout before any folder probe', () => {
    flutterProject();
    put('lib/l10n/app_de.arb', { '@@locale': 'de' });
    const d = detectLocaleSetup(dir);
    assert.equal(d.framework, 'Flutter');
    assert.equal(d.found.localesPattern, 'lib/l10n/app_{lang}.arb');
    assert.equal(d.found.format, 'arb');
    assert.equal(d.found.inputLocale, 'en');
    assert.deepEqual(d.found.sourceFiles, ['lib/l10n/app_en.arb']);
    assert.deepEqual(d.found.targets, ['de']);
    assert.match(describeLocaleSetupHint(dir, 'en'), /set "localesPattern": "lib\/l10n\/app_\{lang\}\.arb"/);
  });

  it('init --yes writes localesPattern (no localesDir), creates the targets, and sync accepts it', async () => {
    flutterProject();
    assert.equal(await runInit({ yes: true, langs: 'fr,de' }, dir), 0, logLines.join('\n'));
    const config = readConfig();
    assert.equal(config.localesPattern, 'lib/l10n/app_{lang}.arb');
    assert.ok(!('localesDir' in config), 'a pattern replaces localesDir');
    assert.equal(config.inputLocale, 'en');
    assert.deepEqual(JSON.parse(read('lib/l10n/app_fr.arb')), { '@@locale': 'fr' });
    assert.ok(!fs.existsSync(path.join(dir, 'locales')), 'no ./locales folder is invented');

    const r = await runSync({ cwd: dir, dryRun: true, cliArgs: {} });
    assert.equal(r.totalProcessed, 2, 'one message × fr, de');
  });

  it('--langs keeps BCP 47 casing: pt_BR stays pt_BR (app_pt_BR.arb, "@@locale": "pt_BR")', async () => {
    assert.deepEqual(parseLanguageInput('FR, pt_br, PT-br, zh_hant, nordic'),
      ['fr', 'pt_BR', 'pt-BR', 'zh_Hant', 'da', 'fi', 'nb', 'sv']);
    flutterProject();
    assert.equal(await runInit({ yes: true, langs: 'pt_BR' }, dir), 0);
    assert.deepEqual(JSON.parse(read('lib/l10n/app_pt_BR.arb')), { '@@locale': 'pt_BR' });
    assert.ok(!logLines.some(l => /Unrecognized language code/.test(l)), 'pt_BR is Portuguese (Brazil), not a typo');
  });

  it('the template file named in l10n.yaml names the source locale', async () => {
    flutterProject({ template: 'app_es.arb' });
    assert.equal(await runInit({ yes: true, langs: 'fr' }, dir), 0);
    assert.equal(readConfig().inputLocale, 'es');
    assert.equal((await runSync({ cwd: dir, dryRun: true, cliArgs: {} })).totalProcessed, 1);
  });

  it('a Flutter project without its template says so, instead of pointing at ./locales silently', () => {
    put('pubspec.yaml', 'name: demo\ndependencies:\n  flutter:\n    sdk: flutter\n');
    const d = detectLocaleSetup(dir);
    assert.equal(d.found, null);
    assert.match(d.hints[0], /gen-l10n template lib\/l10n\/app_en\.arb does not exist/);
  });
});

// -----------------------------------------------------------------
// init — gettext
// -----------------------------------------------------------------
describe('init — a Django project (manage.py + locale/*/LC_MESSAGES/django.po)', () => {
  it('detects the gettext pattern and the source catalog', () => {
    djangoProject();
    const d = detectLocaleSetup(dir);
    assert.equal(d.framework, 'Django');
    assert.equal(d.found.localesPattern, 'locale/{lang}/LC_MESSAGES/{ns}.po');
    assert.equal(d.found.format, 'po');
    assert.deepEqual(d.found.sourceFiles, ['locale/en/LC_MESSAGES/django.po']);
    assert.deepEqual(d.found.targets, ['fr']);
  });

  it('init --yes writes a config sync accepts; a new catalog gets a CLDR Plural-Forms header', async () => {
    djangoProject();
    assert.equal(await runInit({ yes: true, langs: 'fr,ru' }, dir), 0, logLines.join('\n'));
    const config = readConfig();
    assert.equal(config.localesPattern, 'locale/{lang}/LC_MESSAGES/{ns}.po');
    assert.ok(!('localesDir' in config));
    const ru = read('locale/ru/LC_MESSAGES/django.po');
    assert.match(ru, /"Language: ru\\n"/);
    assert.match(ru, /"Plural-Forms: nplurals=3; /);
    assert.equal(read('locale/fr/LC_MESSAGES/django.po'), FR_PO, 'an existing catalog is never touched');

    const r = await runSync({ cwd: dir, dryRun: true, cliArgs: {} });
    assert.equal(r.totalProcessed, 10, '5 entries × fr, ru');
  });

  it('catalogs without a source catalog or template: init says how to make one', () => {
    djangoProject({ source: false });
    const d = detectLocaleSetup(dir);
    assert.equal(d.found, null);
    assert.match(d.hints[0], /no "en" source catalog or \.pot template — create one \(`django-admin makemessages -l en`\)/);
  });

  it('GNU po/ with a .pot template: localesDir + format po', async () => {
    put('po/hello.pot', EN_PO);
    put('po/fr.po', FR_PO);
    const d = detectLocaleSetup(dir);
    assert.equal(d.found.localesDir, './po');
    assert.deepEqual(d.found.sourceFiles, ['po/hello.pot']);
    assert.equal(await runInit({ yes: true, langs: 'de' }, dir), 0, logLines.join('\n'));
    const config = readConfig();
    assert.equal(config.localesDir, './po');
    assert.equal(config.format, 'po');
    assert.ok(fs.existsSync(path.join(dir, 'po', 'de.po')));
    assert.equal((await runSync({ cwd: dir, dryRun: true, cliArgs: {} })).totalProcessed, 5, '5 entries × de (the configured language)');
  });

  it('auto-detects targets in a flat po/ folder when no languages are configured', () => {
    put('po/hello.pot', EN_PO);
    put('po/fr.po', FR_PO);
    put('po/de.po', FR_PO.replace('fr', 'de'));
    put('champollion.config.json', { version: 3, inputLocale: 'en', localesDir: './po', format: 'po' });
    assert.deepEqual(Object.keys(autoDetectLanguages(resolveConfig({}, dir))).sort(), ['de', 'fr']);
  });
});

// -----------------------------------------------------------------
// Help text
// -----------------------------------------------------------------
describe('help — formats, the local method, verify --pair', () => {
  const optionText = (cmd) => COMMAND_HELP[cmd].options.map(([flag, text]) => `${flag} ${text}`).join('\n');

  it('init --help lists every method init accepts, including local, and the po/arb formats', () => {
    const text = optionText('init');
    assert.match(text, /--method <name> .*\blocal\b/);
    assert.match(text, /--format <fmt> .*\bpo\b.*\barb\b/);
    const stdout = spawnSync(process.execPath, [CLI_PATH, 'init', '--help'], { encoding: 'utf-8' }).stdout;
    assert.match(stdout, /local \(your own model/);
  });

  it('sync --help lists po and arb; verify --help documents --pair, ICU/ARB checks and eviction', () => {
    assert.match(optionText('sync'), /--format <fmt> .*\bpo\b.*\barb\b/);
    assert.match(optionText('verify'), /--pair <src:tgt>/);
    const description = COMMAND_HELP.verify.description.join(' ');
    assert.match(description, /ICU MessageFormat structure/);
    assert.match(description, /@@locale/);
    assert.match(description, /removed from the\s+cache/);
  });
});

// -----------------------------------------------------------------
// verify --pair
// -----------------------------------------------------------------
describe('verify --pair', () => {
  it('verifies only the named pair; an unknown pair fails loud', async () => {
    put('messages/en.json', { title: 'Hello {name}' });
    put('messages/fr.json', { title: 'Bonjour {name}' });
    put('messages/es.json', { title: 'Hola {nombre}' }); // damaged placeholder
    put('champollion.config.json', { version: 3, inputLocale: 'en', localesDir: './messages', languages: ['fr', 'es'] });
    assert.equal(await runVerify({}, dir), 1, 'unscoped: Spanish damage fails');
    logLines = [];
    assert.equal(await runVerify({ pair: 'en:fr' }, dir), 0, logLines.join('\n'));
    assert.ok(!logLines.some(l => /\[VERIFY\] es:/.test(l)));
    assert.equal(await runVerify({ pair: 'en:xx' }, dir), 1);
    assert.ok(logLines.some(l => /UNKNOWN PAIR/.test(l)));
  });
});

// -----------------------------------------------------------------
// gettext context in the TM: sync's echo check, the cost estimate
// -----------------------------------------------------------------
describe('gettext msgctxt — sync and the cost estimate consult the context-folded cache entry', () => {
  beforeEach(() => {
    djangoProject();
    put('champollion.config.json', {
      version: 3, inputLocale: 'en', localesPattern: 'locale/{lang}/LC_MESSAGES/{ns}.po',
      defaultMethod: 'test-doc-formats', languages: ['fr'],
    });
  });

  it('a context entry translated to itself is a confirmed echo — not re-queued every sync', async () => {
    const first = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(first.totalFailed, 0, logLines.join('\n'));
    assert.match(read('locale/fr/LC_MESSAGES/django.po'), /msgctxt "brand"\nmsgid "Champollion"\nmsgstr "Champollion"/);
    FakeDocModel.calls = [];
    logLines = [];
    const second = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(second.totalProcessed, 0, logLines.join('\n'));
    assert.ok(logLines.some(l => /fully synced/.test(l)));
  });

  it('the estimate prices the two contexts of "Open" as two cache hits after a sync', async () => {
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    const config = resolveConfig({ 'force-keys': 'verb␄Open,adjective␄Open' }, dir);
    const layout = discoverLocaleLayout(config, { cwd: dir });
    const units = loadSourceUnits(layout).map(u => ({ ...u, changedKeys: [] }));
    const pairs = [...resolvePairs(config).entries()];
    const est = await printCostEstimate(pairs, units[0].flat, config, 'po', '.po', [], {
      cwd: dir, layout, units, noTranslate: { active: false, patterns: [], urls: true, matches: () => false },
    });
    assert.equal(est.pairs[0].keys, 0, 'nothing to bill');
    assert.equal(est.pairs[0].tmHits, 2, 'verb and adjective are each a cache hit');
  });
});

// -----------------------------------------------------------------
// XLIFF
// -----------------------------------------------------------------
describe('xliff — context keys round-trip as "verb␄Open"', () => {
  it('unit ids encode U+0004 as ␄ and newlines as character references, and decode back', () => {
    assert.equal(encodeUnitId(`verb${C}Open`), 'verb␄Open');
    assert.equal(encodeUnitId('Line one\nLine "two"'), 'Line one&#10;Line &quot;two&quot;');
    for (const key of [`verb${C}Open`, 'Line one\nLine two', 'a.b[0]', 'Tom & Jerry']) {
      const xml = exportXLIFF({ sourceLocale: 'en', targetLocale: 'fr', sourceFlat: { [key]: 'x' }, targetFlat: { [key]: 'y' } });
      // eslint-disable-next-line no-control-regex
      assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml), 'XML 1.0 forbids those characters');
      assert.deepEqual(importXLIFF(xml).translations, { [key]: 'y' });
    }
    assert.equal(decodeUnitId('verb␄Open'), `verb${C}Open`);
  });

  it('export → edit in a CAT tool → import updates the right context entry of a .po', async () => {
    djangoProject();
    put('champollion.config.json', {
      version: 3, inputLocale: 'en', localesPattern: 'locale/{lang}/LC_MESSAGES/{ns}.po',
      defaultMethod: 'test-doc-formats', languages: ['fr'],
    });
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(await runXliff({ _: ['xliff', 'export'], locale: 'fr' }, dir), 0, logLines.join('\n'));
    const xliffPath = path.join(dir, '.champollion', 'xliff', 'fr.xliff');
    let xml = fs.readFileSync(xliffPath, 'utf-8');
    assert.ok(xml.includes('id="django::verb␄Open"'));
    assert.ok(!xml.includes(C));
    xml = xml.replace(/(id="django::adjective␄Open"[\s\S]*?<target state="translated">)Ouvert(<\/target>)/, '$1Ouverte$2');
    fs.writeFileSync(xliffPath, xml);
    assert.equal(await runXliff({ _: ['xliff', 'import', xliffPath] }, dir), 0, logLines.join('\n'));
    const fr = read('locale/fr/LC_MESSAGES/django.po');
    assert.match(fr, /msgctxt "adjective"\nmsgid "Open"\nmsgstr "Ouverte"/);
    assert.match(fr, /msgctxt "verb"\nmsgid "Open"\nmsgstr "Ouvrir"/);
    assert.match(fr, /msgstr\[0\] "Un fichier"\nmsgstr\[1\] "%\(count\)d fichiers"/, 'plural entries keep their forms');
    assert.equal(readPO(fr, { locale: 'fr' }).flat[`adjective${C}Open`], 'Ouverte');
  });
});

// -----------------------------------------------------------------
// wrap
// -----------------------------------------------------------------
describe('wrap — refuses Flutter ARB and gettext catalogs before touching a component', () => {
  it('a Flutter project: exit 1, the reason, and no component rewritten', async () => {
    flutterProject();
    put('champollion.config.json', { version: 3, inputLocale: 'en', localesPattern: 'lib/l10n/app_{lang}.arb' });
    const component = put('src/App.jsx', 'export default () => <h1>Welcome to the store</h1>;\n');
    const before = fs.readFileSync(component, 'utf-8');
    assert.equal(await runWrap({ dry: true }, dir), 1);
    assert.ok(logLines.some(l => /wrap does not apply to Flutter ARB files \(app_en\.arb\)/.test(l)), logLines.join('\n'));
    assert.equal(fs.readFileSync(component, 'utf-8'), before);
  });

  it('a gettext project: the reason names the extractor workflow', async () => {
    djangoProject();
    put('champollion.config.json', { version: 3, inputLocale: 'en', localesPattern: 'locale/{lang}/LC_MESSAGES/{ns}.po' });
    assert.equal(await runWrap({ dry: true }, dir), 1);
    assert.ok(logLines.some(l => /wrap does not apply to gettext catalogs .* the key IS the source text/.test(l)), logLines.join('\n'));
  });

  it('addKeysToLocales refuses them too (defense in depth)', () => {
    const p = put('lib/l10n/app_en.arb', EN_ARB);
    assert.equal(wrapUnsupportedReason({ format: 'json', rel: 'en.json' }), null);
    assert.throws(() => addKeysToLocales([{ key: 'general.hi', text: 'Hi' }], { path: p, format: 'arb', rel: 'app_en.arb' }),
      /wrap does not apply to Flutter ARB files/);
    assert.deepEqual(JSON.parse(fs.readFileSync(p, 'utf-8')), EN_ARB, 'nothing written');
  });
});
