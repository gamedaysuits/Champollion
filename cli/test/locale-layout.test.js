/**
 * Locale layouts — where a project's locale files live (lib/locale-layout.js),
 * the i18next plural helper (lib/plurals.js), the config fields that steer
 * them, and `init`'s detection of real project layouts.
 *
 * THE FINDING THIS ENCODES (synthetic user review, 2026-10):
 *   1. A next-intl app (messages/en.json) ran `champollion init --yes` and
 *      got localesDir "./locales" + languages [] — the first sync failed.
 *   2. An i18next app (public/locales/en/common.json: one folder per
 *      language, files = namespaces) was unsupported outright; the docs told
 *      users to write their own flatten/unflatten wrapper.
 *
 * Every layout is exercised against real files in a temp dir. Sync-level
 * behaviour (translation, lock keys, TM reuse, verify) lives in
 * locale-layout-sync.test.js.
 *
 * Run: node --test test/locale-layout.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  discoverLocaleLayout, resolveLocaleFiles, compileLocalesPattern, readLocaleFlat,
  createMissingTargetFiles, lockKey, splitLockKey, keysForNamespace, loadSourceUnits,
  expectedForTarget, formatForExtension,
} from '../lib/locale-layout.js';
import {
  pluralCategoriesFor, findPluralGroups, expandPluralsForLocale, mapSourceKeysToTarget, originKey,
} from '../lib/plurals.js';
import { resolveConfig, autoDetectLanguages } from '../lib/config.js';
import { detectLocaleSetup, describeLocaleSetupHint } from '../lib/commands/init.js';
import { deleteNestedValue } from '../lib/flatten.js';

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

/** Write a tree of files: { 'a/b.json': {...} | 'raw text' }. */
function writeTree(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
}

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-layout-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

// -----------------------------------------------------------------
// flat
// -----------------------------------------------------------------
describe('flat layout (<localesDir>/<code><ext>) — unchanged behaviour', () => {
  it('describes the single source file and mirrors it per target', () => {
    writeTree(dir, { 'locales/en.json': { a: 'A' }, 'locales/fr.json': { a: 'Á' } });
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesDir: path.join(dir, 'locales'), format: 'auto' });
    assert.equal(layout.kind, 'flat');
    assert.equal(layout.namespaced, false);
    assert.equal(layout.format, 'json');
    assert.deepEqual(layout.sourceFiles.map(f => f.rel), ['en.json']);
    const fr = layout.fileFor('fr');
    assert.equal(fr.path, path.join(dir, 'locales', 'fr.json'));
    assert.equal(fr.rel, 'fr.json');
    assert.equal(fr.ns, '');
  });

  it('lists target locales by EXACT code — en-GB is a target when the source is en', () => {
    writeTree(dir, {
      'locales/en.json': { a: 'A' },
      'locales/en-GB.json': { a: 'A' },
      'locales/fr.json': {},
    });
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesDir: path.join(dir, 'locales') });
    assert.deepEqual(layout.listLocales(), ['en-GB', 'fr']);
  });

  it('carries the real .yml extension (the old round trip searched for en.yaml)', () => {
    writeTree(dir, { 'locales/en.yml': 'title: Hello\n', 'locales/fr.yml': 'title: Bonjour\n' });
    for (const format of ['auto', 'yaml']) {
      const layout = discoverLocaleLayout({ inputLocale: 'en', localesDir: path.join(dir, 'locales'), format });
      assert.equal(layout.format, 'yaml');
      assert.equal(layout.sourceFiles[0].ext, '.yml');
      assert.equal(layout.fileFor('de').rel, 'de.yml', `format ${format}: targets keep .yml`);
      assert.deepEqual(layout.listLocales(), ['fr']);
      assert.deepEqual(readLocaleFlat(layout.sourceFiles[0]), { title: 'Hello' });
    }
  });

  it('a missing source keeps the expected path so the error names it', () => {
    fs.mkdirSync(path.join(dir, 'locales'));
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesDir: path.join(dir, 'locales') });
    assert.equal(layout.sourceFiles[0].path, path.join(dir, 'locales', 'en.json'));
    assert.throws(() => loadSourceUnits(layout), /Source locale not found: .*en\.json/);
  });
});

// -----------------------------------------------------------------
// dir
// -----------------------------------------------------------------
describe('dir layout (<localesDir>/<code>/**/<ns><ext>) — i18next', () => {
  beforeEach(() => {
    writeTree(dir, {
      'public/locales/en/common.json': { nav: { home: 'Home' } },
      'public/locales/en/admin/users.json': { title: 'Users' },
      'public/locales/de/common.json': { nav: { home: 'Start' } },
      'public/locales/it/.gitkeep': '',
      'public/locales/utils/helpers.ts': 'export {}',
      'public/locales/README.md': '# locales',
      'public/locales/index.json': {},
    });
  });

  it('auto-detects the folder of namespaces, nested paths included', () => {
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesDir: path.join(dir, 'public/locales') });
    assert.equal(layout.kind, 'dir');
    assert.equal(layout.namespaced, true);
    assert.deepEqual(layout.sourceFiles.map(f => f.ns), ['admin/users', 'common']);
    assert.deepEqual(layout.sourceFiles.map(f => f.rel), ['en/admin/users.json', 'en/common.json']);
    const target = layout.fileFor('fr', 'admin/users');
    assert.equal(target.path, path.join(dir, 'public', 'locales', 'fr', 'admin', 'users.json'));
    assert.deepEqual(resolveLocaleFiles({ inputLocale: 'en', localesDir: path.join(dir, 'public/locales') }, { code: 'fr' })
      .map(f => f.rel), ['fr/admin/users.json', 'fr/common.json']);
  });

  it('locales are sub-folders (empty ones too); stray files and code folders are not', () => {
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesDir: path.join(dir, 'public/locales') });
    assert.deepEqual(layout.listLocales(), ['de', 'it']);
  });

  it('autoDetectLanguages returns the locale folders', () => {
    const detected = autoDetectLanguages({ inputLocale: 'en', localesDir: path.join(dir, 'public/locales'), format: 'auto' });
    assert.deepEqual(Object.keys(detected).sort(), ['de', 'it']);
    assert.equal(detected.de.name, 'German');
  });

  it('refuses to guess when en.json AND a populated en/ both exist', () => {
    writeTree(dir, { 'public/locales/en.json': { a: 'A' } });
    const base = { inputLocale: 'en', localesDir: path.join(dir, 'public/locales') };
    assert.throws(() => discoverLocaleLayout(base), /ambiguous.*localesLayout/s);
    assert.equal(discoverLocaleLayout({ ...base, localesLayout: 'flat' }).kind, 'flat');
    assert.equal(discoverLocaleLayout({ ...base, localesLayout: 'dir' }).kind, 'dir');
  });
});

// -----------------------------------------------------------------
// pattern
// -----------------------------------------------------------------
describe('pattern layout (localesPattern with {lang} and optional {ns})', () => {
  it('public/locales/{lang}/{ns}.json — namespaced', () => {
    writeTree(dir, {
      'public/locales/en/common.json': { a: 'A' },
      'public/locales/en/home.json': { b: 'B' },
      'public/locales/fr/common.json': {},
    });
    const layout = discoverLocaleLayout({
      inputLocale: 'en', localesPattern: path.join(dir, 'public/locales/{lang}/{ns}.json'),
    });
    assert.equal(layout.kind, 'pattern');
    assert.equal(layout.namespaced, true);
    assert.equal(layout.baseDir, path.join(dir, 'public', 'locales'));
    assert.deepEqual(layout.sourceFiles.map(f => f.ns), ['common', 'home']);
    assert.equal(layout.fileFor('de', 'home').path, path.join(dir, 'public', 'locales', 'de', 'home.json'));
    assert.deepEqual(layout.listLocales(), ['fr']);
  });

  it('{ns} may come before {lang}: translations/{ns}/{lang}.json', () => {
    writeTree(dir, {
      'translations/common/en.json': { a: 'A' },
      'translations/common/fr.json': {},
      'translations/legal/en.json': { b: 'B' },
    });
    const layout = discoverLocaleLayout({
      inputLocale: 'en', localesPattern: path.join(dir, 'translations/{ns}/{lang}.json'),
    });
    assert.deepEqual(layout.sourceFiles.map(f => f.ns), ['common', 'legal']);
    assert.equal(layout.fileFor('fr', 'legal').path, path.join(dir, 'translations', 'legal', 'fr.json'));
    assert.deepEqual(layout.listLocales(), ['fr']);
  });

  it('lib/l10n/app_{lang}.arb — one file per locale, format passed through as arb', () => {
    writeTree(dir, {
      'lib/l10n/app_en.arb': { hello: 'Hello' },
      'lib/l10n/app_fr.arb': { hello: 'Bonjour' },
      'lib/l10n/app_pt_BR.arb': { hello: 'Olá' },
    });
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesPattern: path.join(dir, 'lib/l10n/app_{lang}.arb') });
    assert.equal(layout.format, 'arb');
    assert.equal(layout.namespaced, false);
    assert.deepEqual(layout.listLocales(), ['fr', 'pt_BR']);
    // Read as ARB (messages only), not as JSON by accident.
    assert.deepEqual(readLocaleFlat(layout.sourceFiles[0]), { hello: 'Hello' });
  });

  it('locale/{lang}/LC_MESSAGES/{ns}.po — gettext shape, format po', () => {
    writeTree(dir, { 'locale/en/LC_MESSAGES/messages.po': 'msgid ""\nmsgstr ""\n' });
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesPattern: path.join(dir, 'locale/{lang}/LC_MESSAGES/{ns}.po') });
    assert.equal(layout.format, 'po');
    assert.deepEqual(layout.sourceFiles.map(f => f.ns), ['messages']);
    assert.equal(layout.fileFor('fr', 'messages').path, path.join(dir, 'locale', 'fr', 'LC_MESSAGES', 'messages.po'));
  });

  it('rejects malformed patterns loudly', () => {
    assert.throws(() => compileLocalesPattern('locales/common.json'), /must contain \{lang\}/);
    assert.throws(() => compileLocalesPattern('locales/{locale}.json'), /unknown placeholder/);
    assert.throws(() => compileLocalesPattern('{ns}/{lang}/{ns}.json'), /at most once/);
    assert.throws(() => compileLocalesPattern('locales/{lang}'), /file extension/);
  });

  it('refuses the Docusaurus format (it has its own lane)', () => {
    assert.throws(() => discoverLocaleLayout({ inputLocale: 'en', localesDir: dir, format: 'docusaurus' }), /Docusaurus/);
  });
});

// -----------------------------------------------------------------
// namespaced keys + empty target files
// -----------------------------------------------------------------
describe('namespaced keys and empty target files', () => {
  it('lock keys are bare for flat layouts and <ns>::<key> otherwise', () => {
    assert.equal(lockKey({ namespaced: false }, '', 'nav.home'), 'nav.home');
    assert.equal(lockKey({ namespaced: true }, 'common', 'nav.home'), 'common::nav.home');
    assert.deepEqual(splitLockKey({ namespaced: true }, 'admin/users::a::b'), { ns: 'admin/users', key: 'a::b' });
    assert.equal(splitLockKey({ namespaced: true }, 'nav.home'), null);
    assert.deepEqual(splitLockKey({ namespaced: false }, 'x::y'), { ns: '', key: 'x::y' });
  });

  it('--force-keys: "ns::key" names one file, a bare key every file', () => {
    const keys = ['common::nav.home', 'title', 'admin::x'];
    assert.deepEqual(keysForNamespace({ namespaced: true }, keys, 'common'), ['nav.home', 'title']);
    assert.deepEqual(keysForNamespace({ namespaced: true }, keys, 'admin'), ['title', 'x']);
    assert.deepEqual(keysForNamespace({ namespaced: false }, keys, ''), keys);
  });

  it('creates missing target files in the layout, as empty files of the right format', () => {
    writeTree(dir, {
      'locales/en/common.json': { a: 'A' },
      'locales/en/admin/users.json': { b: 'B' },
      'locales/fr/common.json': { a: 'kept' },
    });
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesDir: path.join(dir, 'locales') });
    const { created, refused } = createMissingTargetFiles(layout, ['fr', 'de', '../escape']);
    assert.deepEqual(created.map(f => f.rel).sort(), ['de/admin/users.json', 'de/common.json', 'fr/admin/users.json']);
    assert.equal(fs.readFileSync(path.join(dir, 'locales', 'de', 'common.json'), 'utf-8'), '{}\n');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'locales', 'fr', 'common.json'), 'utf-8')), { a: 'kept' },
      'existing files are never touched');
    assert.ok(refused.length > 0, 'a code that escapes the locales dir is refused, not written');
  });

  it('a TOML/YAML target starts as an empty file that reads back as {}', () => {
    writeTree(dir, { 'i18n/en.toml': '[home]\nother = "Home"\n' });
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesDir: path.join(dir, 'i18n') });
    const { created } = createMissingTargetFiles(layout, ['fr']);
    assert.deepEqual(created.map(f => f.rel), ['fr.toml']);
    assert.deepEqual(readLocaleFlat(layout.fileFor('fr')), {});
  });

  it('a format this version cannot write is reported, not created', () => {
    writeTree(dir, { 'ios/Localizable_en.strings': '"a" = "A";\n' });
    const layout = discoverLocaleLayout({
      inputLocale: 'en', localesPattern: path.join(dir, 'ios/Localizable_{lang}.strings'), format: 'strings',
    });
    const { created, unsupported } = createMissingTargetFiles(layout, ['fr']);
    assert.equal(created.length, 0);
    assert.deepEqual(unsupported.map(f => f.rel), ['Localizable_fr.strings']);
  });

  it('an ARB target starts as {"@@locale": <target>} (Flutter underscore form)', () => {
    writeTree(dir, { 'l10n/app_en.arb': { '@@locale': 'en', a: 'A' } });
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesPattern: path.join(dir, 'l10n/app_{lang}.arb') });
    const { created } = createMissingTargetFiles(layout, ['pt-BR']);
    assert.deepEqual(created.map(f => f.rel), ['app_pt-BR.arb']);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'l10n', 'app_pt-BR.arb'), 'utf-8')), { '@@locale': 'pt_BR' });
  });

  it('deleteNestedValue removes a leaf and prunes parents it empties', () => {
    const data = { cart: { item_one: 'x', item_other: 'y' }, solo: { only_one: 'z' } };
    assert.equal(deleteNestedValue(data, 'cart.item_one'), true);
    assert.equal(deleteNestedValue(data, 'solo.only_one'), true);
    assert.equal(deleteNestedValue(data, 'nope.missing'), false);
    assert.deepEqual(data, { cart: { item_other: 'y' } });
  });

  it('maps every recognised extension to its format', () => {
    assert.equal(formatForExtension('.yml'), 'yaml');
    assert.equal(formatForExtension('.YAML'), 'yaml');
    assert.equal(formatForExtension('.po'), 'po');
    assert.equal(formatForExtension('.txt'), null);
  });
});

// -----------------------------------------------------------------
// config
// -----------------------------------------------------------------
describe('config: format / localesLayout / localesPattern validation', () => {
  const writeConfig = (cfg) => fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify(cfg));

  it('an unknown format fails loud with the supported list (and a .yml hint)', () => {
    writeConfig({ format: 'jsn' });
    assert.throws(() => resolveConfig({}, dir), (err) => err.code === 'CHAMPOLLION_CONFIG_INVALID'
      && /Unknown "format": "jsn"/.test(err.message) && /json, toml, yaml/.test(err.message));
    writeConfig({ format: 'yml' });
    assert.throws(() => resolveConfig({}, dir), /use "yaml"/);
    writeConfig({});
    assert.throws(() => resolveConfig({ format: 'xml' }, dir), /Unknown "format"/, '--format is validated too');
  });

  it('an unknown localesLayout fails loud', () => {
    writeConfig({ localesLayout: 'nested' });
    assert.throws(() => resolveConfig({}, dir), /"localesLayout" must be one of flat, dir/);
  });

  it('localesPattern resolves against the project and fixes localesDir', () => {
    writeConfig({ localesPattern: 'public/locales/{lang}/{ns}.json' });
    const config = resolveConfig({}, dir);
    assert.equal(config.localesPattern, path.join(dir, 'public/locales/{lang}/{ns}.json'));
    assert.equal(config.localesDir, path.join(dir, 'public', 'locales'));
  });

  it('a localesDir that disagrees with localesPattern is an error, not a silent pick', () => {
    writeConfig({ localesPattern: 'public/locales/{lang}/{ns}.json', localesDir: './elsewhere' });
    assert.throws(() => resolveConfig({}, dir), /disagrees with "localesPattern"/);
    writeConfig({ localesPattern: 'public/locales/{lang}/{ns}.json', localesDir: './public/locales' });
    assert.doesNotThrow(() => resolveConfig({}, dir), 'an agreeing localesDir is fine');
  });

  it('localesPattern and localesLayout together are rejected', () => {
    writeConfig({ localesPattern: '{lang}.json', localesLayout: 'flat' });
    assert.throws(() => resolveConfig({}, dir), /either "localesPattern" or "localesLayout"/);
  });

  it('the new fields are known — no "unknown config field" warning', () => {
    writeConfig({ localesPattern: 'l/{lang}.json', defaultNamespace: 'common' });
    const errs = [];
    const orig = console.error;
    console.error = (m) => errs.push(String(m));
    try { resolveConfig({}, dir); } finally { console.error = orig; }
    assert.ok(!errs.some(e => /Unknown config field/.test(e)), errs.join('\n'));
  });
});

// -----------------------------------------------------------------
// i18next plurals
// -----------------------------------------------------------------
describe('i18next plural keys → each target gets its own CLDR categories', () => {
  const SOURCE = {
    title: 'Cart',
    'cart.item_one': '{{count}} item',
    'cart.item_other': '{{count}} items',
    gender_other: 'Other',
  };

  it('reads categories from CLDR via Intl (and knows when CLDR has none)', () => {
    assert.deepEqual(pluralCategoriesFor('fr'), ['one', 'many', 'other']);
    assert.deepEqual(pluralCategoriesFor('ja'), ['other']);
    assert.deepEqual(pluralCategoriesFor('pt_BR'), ['one', 'many', 'other'], 'underscore codes normalise');
    assert.equal(pluralCategoriesFor('tlh'), null, 'no CLDR rules → null, never a guess');
  });

  it('detects groups strictly: a lone gender_other is an ordinary key', () => {
    const groups = findPluralGroups(SOURCE, 'en');
    assert.equal(groups.size, 1);
    assert.equal(findPluralGroups({ n_other: '{{count}} 個' }, 'ja').size, 1,
      'a one-category source (ja) needs only _other — when it interpolates {{count}}');
    assert.equal(findPluralGroups({ n_other: 'その他' }, 'ja').size, 0);
  });

  it('French and Spanish gain _many (from _other); Japanese keeps only _other', () => {
    for (const code of ['fr', 'es']) {
      const e = expandPluralsForLocale(SOURCE, 'en', code);
      assert.deepEqual(Object.keys(e.flat), ['title', 'cart.item_one', 'cart.item_many', 'cart.item_other', 'gender_other']);
      assert.equal(e.flat['cart.item_many'], '{{count}} items');
      assert.equal(e.origin['cart.item_many'], 'cart.item_other');
      assert.match(e.descriptions['cart.item_many'], /"many"/);
      assert.deepEqual(e.unused, []);
    }
    const ja = expandPluralsForLocale(SOURCE, 'en', 'ja');
    assert.deepEqual(Object.keys(ja.flat), ['title', 'cart.item_other', 'gender_other']);
    assert.deepEqual(ja.unused, ['cart.item_one']);
  });

  it('_one comes from the source _one; an explicit _zero is kept for every language', () => {
    const src = { x_zero: 'none', x_one: 'one {{count}}', x_other: '{{count}} things' };
    const ar = expandPluralsForLocale(src, 'en', 'ar');
    assert.deepEqual(Object.keys(ar.flat), ['x_zero', 'x_one', 'x_two', 'x_few', 'x_many', 'x_other']);
    assert.equal(ar.flat.x_zero, 'none');
    assert.equal(ar.flat.x_one, 'one {{count}}');
    assert.equal(ar.flat.x_two, '{{count}} things');
    const ja = expandPluralsForLocale(src, 'en', 'ja');
    assert.deepEqual(Object.keys(ja.flat), ['x_zero', 'x_other'], 'i18next resolves _zero for count 0 in every language');
  });

  it('ordinal groups use ordinal rules', () => {
    const src = { p_ordinal_one: '{{count}}st', p_ordinal_two: '{{count}}nd', p_ordinal_few: '{{count}}rd', p_ordinal_other: '{{count}}th' };
    const fr = expandPluralsForLocale(src, 'en', 'fr');
    assert.deepEqual(Object.keys(fr.flat), ['p_ordinal_one', 'p_ordinal_other']);
  });

  it('a locale without CLDR rules mirrors the source forms and says so', () => {
    const e = expandPluralsForLocale(SOURCE, 'en', 'tlh');
    assert.equal(e.unknownLocale, true);
    assert.deepEqual(Object.keys(e.flat), Object.keys(SOURCE));
  });

  it('changed/forced source keys map onto the target keys translated from them', () => {
    const e = expandPluralsForLocale(SOURCE, 'en', 'fr');
    assert.deepEqual(mapSourceKeysToTarget(['cart.item_other'], e).sort(), ['cart.item_many', 'cart.item_other']);
    assert.equal(originKey('cart.item_many', e), 'cart.item_other');
    assert.equal(originKey('title', e), 'title');
  });

  it('expectedForTarget only expands JSON source files', () => {
    writeTree(dir, { 'locales/en.json': { a_one: '{{count}} a', a_other: '{{count}} as' } });
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesDir: path.join(dir, 'locales') });
    const [unit] = loadSourceUnits(layout);
    assert.deepEqual(Object.keys(expectedForTarget(unit, 'en', 'es').flat), ['a_one', 'a_many', 'a_other']);
    assert.equal(expectedForTarget(unit, 'en', 'es').expansion.groups, 1);
  });
});

// -----------------------------------------------------------------
// init detection
// -----------------------------------------------------------------
describe('init: detects the project layout from files on disk', () => {
  const runInit = (args) => spawnSync(process.execPath, [CLI_PATH, 'init', ...args], { cwd: dir, encoding: 'utf-8' });
  const readConfig = () => JSON.parse(fs.readFileSync(path.join(dir, 'champollion.config.json'), 'utf-8'));

  it('next-intl: messages/{lang}.json', () => {
    writeTree(dir, {
      'package.json': { dependencies: { 'next-intl': '^3.0.0' } },
      'messages/en.json': { Home: { title: 'Hello' } },
      'messages/de.json': { Home: { title: 'Hallo' } },
    });
    const d = detectLocaleSetup(dir, { source: 'en' });
    assert.equal(d.framework, 'next-intl');
    assert.equal(d.found.localesDir, './messages');
    assert.equal(d.found.layout, 'flat');
    assert.deepEqual(d.found.targets, ['de']);

    const r = runInit(['--yes', '--langs', 'fr']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Detected locale files: messages\/\{lang\}\.json \(next-intl\)/);
    assert.equal(readConfig().localesDir, './messages');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'messages', 'fr.json'), 'utf-8')), {},
      '--langs creates the empty target file');
  });

  it('i18next: public/locales/{lang}/{ns}.json, target files mirror every namespace', () => {
    writeTree(dir, {
      'package.json': { dependencies: { i18next: '^23', 'react-i18next': '^13' } },
      'public/locales/en/common.json': { nav: { home: 'Home' } },
      'public/locales/en/admin/users.json': { title: 'Users' },
    });
    const d = detectLocaleSetup(dir, { source: 'en' });
    assert.equal(d.framework, 'react-i18next');
    assert.equal(d.found.localesDir, './public/locales');
    assert.equal(d.found.layout, 'dir');

    const r = runInit(['--yes', '--langs', 'fr,de']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readConfig().localesDir, './public/locales');
    for (const rel of ['fr/common.json', 'fr/admin/users.json', 'de/common.json', 'de/admin/users.json']) {
      assert.ok(fs.existsSync(path.join(dir, 'public', 'locales', ...rel.split('/'))), `${rel} created`);
    }
  });

  it('i18next falls back to locales/{lang}/ when public/locales is absent', () => {
    writeTree(dir, {
      'package.json': { dependencies: { i18next: '^23' } },
      'locales/en/translation.json': { a: 'A' },
    });
    const d = detectLocaleSetup(dir, { source: 'en' });
    assert.equal(d.found.localesDir, './locales');
    assert.equal(d.found.layout, 'dir');
  });

  it('vue-i18n: src/locales/{lang}.json', () => {
    writeTree(dir, {
      'package.json': { dependencies: { 'vue-i18n': '^9' } },
      'src/locales/en.json': { a: 'A' },
    });
    const d = detectLocaleSetup(dir, { source: 'en' });
    assert.equal(d.framework, 'vue-i18n');
    assert.equal(d.found.localesDir, './src/locales');
    assert.equal(d.found.layout, 'flat');
  });

  it('Hugo: i18n/{lang}.toml', () => {
    writeTree(dir, { 'hugo.toml': 'baseURL = "/"\n', 'i18n/en.toml': '[home]\nother = "Home"\n' });
    const d = detectLocaleSetup(dir, { source: 'en' });
    assert.equal(d.framework, 'Hugo');
    assert.equal(d.found.localesDir, './i18n');
    assert.equal(d.found.format, 'toml');
  });

  it('generic flat project: locales/en.json', () => {
    writeTree(dir, { 'locales/en.json': { a: 'A' }, 'locales/fr.json': {} });
    const d = detectLocaleSetup(dir, { source: 'en' });
    assert.equal(d.framework, 'generic');
    assert.equal(d.found.localesDir, './locales');
    assert.deepEqual(d.found.targets, ['fr']);
  });

  it('reports a near miss (locale files without the source) instead of guessing', () => {
    writeTree(dir, { 'messages/de.json': { a: 'A' } });
    const d = detectLocaleSetup(dir, { source: 'en' });
    assert.equal(d.found, null);
    assert.deepEqual(d.nearMisses, [{ localesDir: './messages', locales: ['de'] }]);
    assert.match(describeLocaleSetupHint(dir, 'en'), /no "en" source/);
  });

  it('init --yes never writes a localesDir that does not exist', () => {
    const r = runInit(['--yes']);
    assert.equal(r.status, 0, r.stderr);
    const config = readConfig();
    assert.ok(fs.existsSync(path.join(dir, config.localesDir)), `${config.localesDir} must exist`);
    assert.match(r.stdout, /Put your source strings in \.\/locales\/en\.json/);
    assert.match(r.stdout, /Choose target languages: list them in "languages" in champollion\.config\.json/);
  });

  it('with no --langs, names the targets already on disk', () => {
    writeTree(dir, { 'locales/en.json': { a: 'A' }, 'locales/es.json': {} });
    const r = runInit(['--yes']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Target locales found on disk: es/);
    assert.deepEqual(readConfig().languages, []);
  });

  it('writes localesLayout when both shapes exist, so sync does not have to guess', () => {
    writeTree(dir, {
      'package.json': { dependencies: { i18next: '^23' } },
      'public/locales/en.json': { a: 'A' },
      'public/locales/en/common.json': { b: 'B' },
    });
    const r = runInit(['--yes']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readConfig().localesLayout, 'dir');
  });

  it('rejects an unknown --format before writing anything', () => {
    const r = runInit(['--yes', '--format', 'jsn']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown --format "jsn"/);
    assert.ok(!fs.existsSync(path.join(dir, 'champollion.config.json')));
  });
});
