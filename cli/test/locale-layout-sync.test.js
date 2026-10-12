/**
 * Sync, verify, integrity, xliff, the cost estimate and wrap over every
 * locale layout — end to end against real files, translation stubbed.
 *
 * What must hold (see lib/locale-layout.js):
 *   - folder-per-locale (i18next) and localesPattern projects sync file by
 *     file: per-file diff / translate / write, lock keys "<ns>::<key>";
 *   - a flat project is byte-for-byte what it was: bare lock keys, the same
 *     file paths, the same report lines;
 *   - the Translation Memory stays keyed by source TEXT: a string in two
 *     namespace files is paid for once per locale;
 *   - targets are discovered by exact code (en-GB is verified when the
 *     source is en) and a `.yml` project writes `.yml`;
 *   - i18next plural keys give each locale its own CLDR plural forms.
 *
 * Hermetic: google-translate with globalThis.fetch stubbed (the pattern of
 * force-and-heal.test.js). The stub translates "<text>" to "<lang>⟨<text>⟩"
 * (plus a Japanese letter for ja: the wrong-script check classifies letters
 * by Unicode script, so Latin letters in brackets are still Latin) and keeps
 * every {{placeholder}}.
 *
 * Run: node --test test/locale-layout-sync.test.js
 */

import { readManifest } from '../lib/hash.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runSync } from '../lib/sync.js';
import { resolveConfig } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';
import { verifyLocales } from '../lib/verify.js';
import { printCostEstimate } from '../lib/cost-report.js';
import { discoverLocaleLayout, loadSourceUnits } from '../lib/locale-layout.js';
import { loadTM, saveTM, storeTM, tmMethodKey } from '../lib/tm.js';
// The lock's source-hash map (version 1 is the map itself; version 2 nests
// it under "source" beside the per-locale record — lib/hash.js).
const lockSource = () => readManifest(dir);
import { output } from '../lib/output.js';

const tr = (lang, text) => (lang === 'ja' ? `${lang}⟨${text}⟩訳` : `${lang}⟨${text}⟩`);

let dir;
let requested; // [{ target, q: [...] }]
let originalFetch;
let saved;
let logLines;
let origLog;
let origErr;
let origWrite;

function writeTree(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
}
const readJSON = (rel) => JSON.parse(fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf-8'));
const writeConfig = (cfg) => fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
  version: 3, inputLocale: 'en', defaultMethod: 'google-translate', ...cfg,
}, null, 2));
const textsFor = (lang) => requested.filter(r => r.target === lang).flatMap(r => r.q);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-layout-sync-'));
  saved = { g: process.env.GOOGLE_TRANSLATE_API_KEY, o: process.env.OPENROUTER_API_KEY };
  process.env.GOOGLE_TRANSLATE_API_KEY = 'test-key';
  delete process.env.OPENROUTER_API_KEY;
  requested = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    requested.push({ target: body.target, q: body.q });
    return {
      ok: true, status: 200,
      json: async () => ({ data: { translations: body.q.map(t => ({ translatedText: tr(body.target, t) })) } }),
    };
  };
  // Capture (not print) the human report: some tests assert on its lines.
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
  globalThis.fetch = originalFetch;
  console.log = origLog;
  console.error = origErr;
  process.stdout.write = origWrite;
  output.setMode('default');
  if (saved.g === undefined) delete process.env.GOOGLE_TRANSLATE_API_KEY;
  else process.env.GOOGLE_TRANSLATE_API_KEY = saved.g;
  if (saved.o !== undefined) process.env.OPENROUTER_API_KEY = saved.o;
  fs.rmSync(dir, { recursive: true, force: true });
});

// -----------------------------------------------------------------
// dir layout (i18next)
// -----------------------------------------------------------------
describe('sync — folder per locale (public/locales/{lang}/{ns}.json)', () => {
  beforeEach(() => {
    writeTree(dir, {
      'public/locales/en/common.json': { nav: { home: 'Home page', about: 'About us' } },
      'public/locales/en/admin/users.json': { title: 'Users list', home: 'Home page' },
    });
    writeConfig({ localesDir: './public/locales', languages: ['fr', 'de'] });
  });

  it('writes every namespace file per locale, with namespaced lock keys', async () => {
    const r = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(r.totalFailed, 0);
    assert.deepEqual(readJSON('public/locales/fr/common.json'),
      { nav: { home: tr('fr', 'Home page'), about: tr('fr', 'About us') } });
    assert.deepEqual(readJSON('public/locales/de/admin/users.json'),
      { title: tr('de', 'Users list'), home: tr('de', 'Home page') });

    const lock = lockSource();
    assert.deepEqual(Object.keys(lock).sort(), [
      'admin/users::home', 'admin/users::title', 'common::nav.about', 'common::nav.home',
    ]);
  });

  it('pays for a string once per locale even when two files contain it (TM keyed by text)', async () => {
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    for (const lang of ['fr', 'de']) {
      const sent = textsFor(lang);
      assert.equal(sent.filter(t => t === 'Home page').length, 1, `${lang}: "Home page" sent once — ${JSON.stringify(sent)}`);
      assert.equal(sent.length, 3, `${lang}: 3 distinct texts, not 4 keys`);
    }
  });

  it('a settled project syncs to zero work; an edited source string re-translates in its file only', async () => {
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    requested = [];
    const settled = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(settled.totalProcessed, 0);
    assert.equal(requested.length, 0);

    writeTree(dir, { 'public/locales/en/common.json': { nav: { home: 'Home page', about: 'About the team' } } });
    const changed = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(changed.totalProcessed, 2, 'one changed key × two locales');
    assert.deepEqual(textsFor('fr'), ['About the team']);
    assert.equal(readJSON('public/locales/fr/common.json').nav.about, tr('fr', 'About the team'));
    assert.equal(readJSON('public/locales/fr/admin/users.json').home, tr('fr', 'Home page'), 'other file untouched');
  });

  it('auto-detects target locales from the locale folders when none are configured', async () => {
    writeConfig({ localesDir: './public/locales' });
    fs.mkdirSync(path.join(dir, 'public', 'locales', 'es'));
    const r = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(r.totalFailed, 0);
    assert.ok(fs.existsSync(path.join(dir, 'public', 'locales', 'es', 'admin', 'users.json')));
  });

  it('--force-keys accepts "<ns>::<key>" (one file) and bare keys (every file)', async () => {
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    requested = [];
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true, 'no-tm': true, pair: 'en:fr', 'force-keys': 'common::nav.about' } });
    assert.deepEqual(textsFor('fr'), ['About us']);
    requested = [];
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true, 'no-tm': true, pair: 'en:fr', 'force-keys': 'home' } });
    assert.deepEqual(textsFor('fr'), ['Home page'], 'bare "home" matches admin/users::home (common has nav.home)');
  });

  it('dry-run lists queued keys in the namespaced key space', async () => {
    output.setMode('json');
    await runSync({ cwd: dir, dryRun: true, cliArgs: {} });
    const summary = logLines.map(l => { try { return JSON.parse(l); } catch { return null; } })
      .find(o => o && o.level === 'summary');
    const fr = summary.locales.find(l => l.target === 'fr');
    assert.deepEqual(fr.queuedKeys.missing.sort(), [
      'admin/users::home', 'admin/users::title', 'common::nav.about', 'common::nav.home',
    ]);
    assert.ok(!fs.existsSync(path.join(dir, 'public', 'locales', 'fr')), 'dry run writes nothing');
  });

  it('audit counts a missing namespace file as untranslated', async () => {
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    fs.rmSync(path.join(dir, 'public', 'locales', 'de', 'admin'), { recursive: true });
    const r = await runSync({ cwd: dir, audit: true, cliArgs: {} });
    assert.equal(r.untranslatedCount, 2);
    assert.equal(r.missingLocaleCount, 1);
  });

  it('verify flags a missing namespace file and passes a complete locale', async () => {
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    const config = resolveConfig({}, dir);
    assert.deepEqual(await verifyLocales(config, dir), { errors: 0, warnings: 0 });
    fs.rmSync(path.join(dir, 'public', 'locales', 'de', 'common.json'));
    const v = await verifyLocales(config, dir);
    assert.equal(v.errors, 1);
    assert.ok(logLines.some(l => /\[VERIFY\] de: common: 2 missing key/.test(l)), logLines.join('\n'));
  });

  it('the cost estimate prices a string shared by two files once', async () => {
    const config = resolveConfig({}, dir);
    const layout = discoverLocaleLayout(config, { cwd: dir });
    const units = loadSourceUnits(layout).map(u => ({ ...u, changedKeys: [] }));
    const pairs = [...resolvePairs(config).entries()].filter(([k]) => k === 'en:fr');
    const est = await printCostEstimate(pairs, units[0].flat, config, 'json', '.json', [],
      { cwd: dir, tm: { _meta: { version: 1 } }, layout, units });
    assert.equal(est.pairs[0].keys, 3, '4 keys, 3 distinct texts — "Home page" priced once');
  });
});

// -----------------------------------------------------------------
// pattern layout
// -----------------------------------------------------------------
describe('sync — localesPattern', () => {
  it('translations/{ns}/{lang}.json — namespace folder first', async () => {
    writeTree(dir, {
      'translations/common/en.json': { hello: 'Hello' },
      'translations/legal/en.json': { terms: 'Terms of use' },
    });
    writeConfig({ localesPattern: 'translations/{ns}/{lang}.json', languages: ['fr'] });
    const r = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(r.totalFailed, 0);
    assert.deepEqual(readJSON('translations/common/fr.json'), { hello: tr('fr', 'Hello') });
    assert.deepEqual(readJSON('translations/legal/fr.json'), { terms: tr('fr', 'Terms of use') });
    assert.deepEqual(Object.keys(lockSource()).sort(), ['common::hello', 'legal::terms']);
  });

  it('a pattern without {ns} is one file per locale with bare lock keys', async () => {
    writeTree(dir, { 'src/lang/strings.en.json': { hello: 'Hello' } });
    writeConfig({ localesPattern: 'src/lang/strings.{lang}.json', languages: ['de'] });
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.deepEqual(readJSON('src/lang/strings.de.json'), { hello: tr('de', 'Hello') });
    assert.deepEqual(Object.keys(lockSource()), ['hello']);
  });
});

// -----------------------------------------------------------------
// flat — backward compatibility
// -----------------------------------------------------------------
describe('sync — flat projects are unchanged', () => {
  it('bare lock keys, <code>.json paths, the same report lines', async () => {
    writeTree(dir, { 'locales/en.json': { nav: { home: 'Home' }, cta: 'Get started', n: 3 } });
    writeConfig({ localesDir: './locales', languages: ['fr'] });
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });

    assert.deepEqual(Object.keys(lockSource()).sort(), ['cta', 'n', 'nav.home']);
    assert.deepEqual(readJSON('locales/fr.json'), { nav: { home: tr('fr', 'Home') }, cta: tr('fr', 'Get started'), n: 3 });
    assert.deepEqual(fs.readdirSync(path.join(dir, 'locales')).sort(), ['en.json', 'fr.json']);
    const report = logLines.join('\n');
    assert.match(report, /\[INFO\] Detected format: json \(auto\)/);
    assert.match(report, /\[INFO\] Source: en\.json \(3 keys\)/);
    assert.match(report, /\[INFO\] fr\.json — 3 missing/);
    assert.doesNotMatch(report, /Locale layout:/, 'flat projects print no new layout line');
  });

  it('a .yml project reads en.yml and writes fr.yml (never fr.yaml)', async () => {
    writeTree(dir, { 'i18n/en.yml': 'nav:\n  home: Home\ncta: Get started\n' });
    writeConfig({ localesDir: './i18n', languages: ['fr'] });
    const r = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(r.totalFailed, 0);
    assert.ok(fs.existsSync(path.join(dir, 'i18n', 'fr.yml')));
    assert.ok(!fs.existsSync(path.join(dir, 'i18n', 'fr.yaml')));
    assert.match(fs.readFileSync(path.join(dir, 'i18n', 'fr.yml'), 'utf-8'), /fr⟨Home⟩/);
  });

  it('verify checks en-GB when the source is en (exact code match)', async () => {
    writeTree(dir, {
      'locales/en.json': { a: 'Colour of the sky', b: 'Favourite things' },
      'locales/en-GB.json': { a: 'Colour of the sky' },
    });
    writeConfig({ localesDir: './locales' });
    const config = resolveConfig({}, dir);
    const v = await verifyLocales(config, dir);
    assert.ok(v.errors >= 1, 'en-GB is missing key "b"');
    assert.ok(logLines.some(l => /\[VERIFY\] en-GB: 1 missing key/.test(l)), logLines.join('\n'));
  });

  it('integrity audits en-GB too', async () => {
    writeTree(dir, {
      'locales/en.json': { a: 'Hello {name}' },
      'locales/en-GB.json': { a: 'Hello' },
    });
    writeConfig({ localesDir: './locales' });
    const { run } = await import('../lib/commands/integrity.js');
    const code = await run({ _: ['integrity'], json: true }, dir);
    const doc = JSON.parse(logLines.find(l => l.trim().startsWith('{') && l.includes('"command": "integrity"')));
    assert.equal(code, 1);
    assert.deepEqual(doc.locales.map(l => l.locale), ['en-GB']);
    assert.equal(doc.locales[0].issues.placeholderIssues.length, 1);
  });
});

// -----------------------------------------------------------------
// i18next plurals
// -----------------------------------------------------------------
describe('sync — i18next plural keys get each locale\'s CLDR forms', () => {
  beforeEach(() => {
    writeTree(dir, {
      'locales/en.json': { cart: { item_one: '{{count}} item', item_other: '{{count}} items' }, title: 'Cart' },
    });
  });

  it('fr and es gain _many, ja keeps only _other; verify agrees', async () => {
    writeConfig({ localesDir: './locales', languages: ['fr', 'es', 'ja'] });
    const r = await runSync({ cwd: dir, cliArgs: {} });
    assert.equal(r.totalFailed, 0);
    for (const lang of ['fr', 'es']) {
      assert.deepEqual(readJSON(`locales/${lang}.json`).cart, {
        item_one: tr(lang, '{{count}} item'),
        item_many: tr(lang, '{{count}} items'),
        item_other: tr(lang, '{{count}} items'),
      });
    }
    assert.deepEqual(readJSON('locales/ja.json').cart, { item_other: tr('ja', '{{count}} items') });
    assert.equal(r.verifyErrors, 0, logLines.filter(l => /VERIFY/.test(l)).join('\n'));
    // Lock stays in SOURCE keys — no generated key leaks into it.
    assert.deepEqual(Object.keys(lockSource()).sort(), ['cart.item_one', 'cart.item_other', 'title']);
  });

  it('an edited _other re-translates the _many generated from it', async () => {
    writeConfig({ localesDir: './locales', languages: ['fr'] });
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    writeTree(dir, { 'locales/en.json': { cart: { item_one: '{{count}} item', item_other: '{{count}} products' }, title: 'Cart' } });
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    const fr = readJSON('locales/fr.json').cart;
    assert.equal(fr.item_many, tr('fr', '{{count}} products'));
    assert.equal(fr.item_other, tr('fr', '{{count}} products'));
  });

  it('removes a plural form ja does not use only when the TM proves sync wrote it', async () => {
    writeTree(dir, {
      'locales/en.json': {
        cart: { item_one: '{{count}} item', item_other: '{{count}} items' },
        seat: { n_one: '{{count}} seat', n_other: '{{count}} seats' },
      },
      'locales/ja.json': {
        cart: { item_one: 'MACHINE', item_other: '{{count}} 個' },
        seat: { n_one: 'HUMAN', n_other: '{{count}} 席' },
      },
    });
    writeConfig({ localesDir: './locales', languages: ['ja'] });
    // An earlier, plural-unaware sync translated cart.item_one → "MACHINE".
    const tm = loadTM(dir);
    const tmKey = tmMethodKey(resolvePairs(resolveConfig({}, dir)).get('en:ja'));
    storeTM(tm, '{{count}} item', 'ja', tmKey, 'MACHINE');
    saveTM(dir, tm);

    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    const ja = readJSON('locales/ja.json');
    assert.deepEqual(ja.cart, { item_other: '{{count}} 個' }, 'pipeline-written _one removed');
    assert.equal(ja.seat.n_one, 'HUMAN', 'a hand-written _one is never deleted');
    assert.ok(logLines.some(l => /removed 1 plural form\(s\) ja does not use/.test(l)), logLines.join('\n'));
  });
});

// -----------------------------------------------------------------
// xliff on a folder-per-locale project
// -----------------------------------------------------------------
describe('xliff — one document per locale, routed back by namespace', () => {
  beforeEach(() => {
    writeTree(dir, {
      'public/locales/en/common.json': { nav: { home: 'Home' } },
      'public/locales/en/admin.json': { title: 'Admin' },
    });
    writeConfig({ localesDir: './public/locales', languages: ['fr'] });
  });

  it('exports "<ns>::<key>" units and imports them into the right files', async () => {
    const { run } = await import('../lib/commands/xliff.js');
    const outPath = path.join(dir, 'fr.xliff');
    assert.equal(await run({ _: ['xliff', 'export'], locale: 'fr', out: outPath }, dir), 0);
    let xliff = fs.readFileSync(outPath, 'utf-8');
    assert.match(xliff, /id="admin::title"/);
    assert.match(xliff, /id="common::nav\.home"/);

    xliff = xliff
      .replace(/(<source>Home<\/source>\s*<target state=")new(">)<\/target>/, '$1translated$2Accueil</target>')
      .replace(/(<source>Admin<\/source>\s*<target state=")new(">)<\/target>/, '$1translated$2Administration</target>');
    fs.writeFileSync(outPath, xliff);
    assert.equal(await run({ _: ['xliff', 'import', outPath] }, dir), 0);
    assert.deepEqual(readJSON('public/locales/fr/common.json'), { nav: { home: 'Accueil' } });
    assert.deepEqual(readJSON('public/locales/fr/admin.json'), { title: 'Administration' });
  });

  it('refuses an XLIFF whose ids name no namespace', async () => {
    const { run } = await import('../lib/commands/xliff.js');
    const outPath = path.join(dir, 'bad.xliff');
    fs.writeFileSync(outPath, `<?xml version="1.0"?><xliff version="1.2"><file original="x" source-language="en" target-language="fr"><body>
      <trans-unit id="nav.home"><source>Home</source><target>Accueil</target></trans-unit></body></file></xliff>`);
    assert.equal(await run({ _: ['xliff', 'import', outPath] }, dir), 1);
    assert.ok(logLines.some(l => /do not name one of this project's locale files/.test(l)));
    assert.ok(!fs.existsSync(path.join(dir, 'public', 'locales', 'fr')), 'nothing written');
  });
});

// -----------------------------------------------------------------
// wrap
// -----------------------------------------------------------------
describe('wrap — chooses the namespace file before touching source code', () => {
  it('several namespaces and no defaultNamespace → a clear error, nothing rewritten', async () => {
    writeTree(dir, {
      'public/locales/en/common.json': { a: 'A' },
      'public/locales/en/admin.json': { b: 'B' },
      'src/App.jsx': 'export const App = () => <h1>Hello wonderful world</h1>;\n',
    });
    writeConfig({ localesDir: './public/locales' });
    const { run } = await import('../lib/commands/wrap.js');
    const code = await run({ _: ['wrap'], dry: true }, dir);
    assert.equal(code, 1);
    assert.ok(logLines.some(l => /Set "defaultNamespace"/.test(l)), logLines.join('\n'));
  });
});

// -----------------------------------------------------------------
// lint
// -----------------------------------------------------------------
describe('lint — reads keys from every namespace file', () => {
  it('t("common:nav.home") and t("title") both count; unused keys are dead', async () => {
    writeTree(dir, {
      'package.json': { dependencies: { 'react-i18next': '^13' } },
      'public/locales/en/common.json': { nav: { home: 'Home', unused: 'Never used' } },
      'public/locales/en/admin.json': { title: 'Admin' },
      'src/App.jsx': [
        "import { useTranslation } from 'react-i18next';",
        'export const App = () => {',
        "  const { t } = useTranslation();",
        "  return <nav>{t('common:nav.home')}{t('title')}</nav>;",
        '};',
        '',
      ].join('\n'),
    });
    writeConfig({ localesDir: './public/locales' });
    const { runLint } = await import('../lib/lint.js');
    await runLint({ cwd: dir, cliArgs: { json: true }, warnOnly: true });
    const doc = JSON.parse(logLines.find(l => l.includes('"command": "lint"')));
    assert.equal(doc.localeKeys, 3, 'keys from both namespace files');
    assert.deepEqual(doc.deadKeys, ['nav.unused']);
  });
});
