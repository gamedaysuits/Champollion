/**
 * Flutter ARB files (lib/format.js, lib/locale-layout.js).
 *
 * THE FINDING THIS ENCODES (synthetic Flutter user, 2026-10): a copy of
 * app_en.arb synced as JSON had "@@locale" translated to "én", the
 * placeholder metadata types "String"/"int" translated, and ICU plural
 * keywords and variable names translated. `flutter gen-l10n` refused to
 * build, while sync's gate, `integrity` and `verify` all said "All checks
 * passed".
 *
 * THE MODEL: only messages are translatable. `@@locale` is set to the TARGET
 * locale (Flutter's underscore form, matching the file name); every `@key`
 * metadata object is copied from the source (or kept from the target when
 * the source has none); key order follows the source. ICU damage is refused
 * by the gate and reported by verify/integrity; damage OUTSIDE the messages
 * (@@locale, placeholder metadata) is reported too.
 *
 * Run: node --test test/arb-format.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readLocaleFile, writeLocaleFile, serializeARB, readLocaleContext, LOCALE_FILE_FORMATS } from '../lib/format.js';
import {
  discoverLocaleLayout, readLocaleFlat, createMissingTargetFiles, detectFlutterL10n, loadSourceUnits, expectedForTarget,
} from '../lib/locale-layout.js';
import { METHOD_REGISTRY } from '../lib/translate.js';
import { TranslationMethod } from '../lib/methods/base.js';
import { runSync } from '../lib/sync.js';
import { resolveConfig } from '../lib/config.js';
import { verifyLocales } from '../lib/verify.js';
import { auditARBDocument } from '../lib/integrity.js';
import { run as runIntegrity } from '../lib/commands/integrity.js';
import { output } from '../lib/output.js';

const EN = {
  '@@locale': 'en',
  helloWorld: 'Hello {name}!',
  '@helloWorld': {
    description: 'Greeting on the home screen',
    placeholders: { name: { type: 'String', example: 'Ada' } },
  },
  itemCount: '{count, plural, =0{No items} one{1 item} other{{count} items}}',
  '@itemCount': { description: 'Cart badge', placeholders: { count: { type: 'int' } } },
  signOut: 'Sign out',
};

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-arb-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const write = (rel, data) => {
  const p = path.join(dir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return p;
};
const read = (rel) => JSON.parse(fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf-8'));

// -----------------------------------------------------------------
// Read / write
// -----------------------------------------------------------------
describe('ARB read/write', () => {
  it('arb is a supported locale format', () => {
    assert.ok(LOCALE_FILE_FORMATS.includes('arb'));
    assert.ok(LOCALE_FILE_FORMATS.includes('po'));
  });

  it('reads messages only — never @@locale or @key metadata', () => {
    const p = write('app_en.arb', EN);
    assert.deepEqual(readLocaleFile(p, 'arb'), {
      helloWorld: 'Hello {name}!',
      itemCount: '{count, plural, =0{No items} one{1 item} other{{count} items}}',
      signOut: 'Sign out',
    });
  });

  it('descriptions become prompt context', () => {
    const p = write('app_en.arb', EN);
    assert.deepEqual(readLocaleContext(p, 'arb'), {
      helloWorld: 'Greeting on the home screen', itemCount: 'Cart badge',
    });
  });

  it('writes @@locale = the TARGET (underscore form), metadata from the source, source key order', () => {
    const out = JSON.parse(serializeARB({
      flat: { signOut: 'Se déconnecter', helloWorld: 'Bonjour {name} !' },
      sourceDoc: EN, targetDoc: null, locale: 'pt-BR',
    }));
    assert.deepEqual(Object.keys(out), ['@@locale', 'helloWorld', '@helloWorld', 'signOut']);
    assert.equal(out['@@locale'], 'pt_BR');
    assert.deepEqual(out['@helloWorld'], EN['@helloWorld'], 'metadata copied verbatim, never translated');
    assert.ok(!('itemCount' in out) && !('@itemCount' in out), 'an untranslated message (and its metadata) is absent');
  });

  it('global @@ attributes are kept (the target\'s own when it has one)', () => {
    const out = JSON.parse(serializeARB({
      flat: { signOut: 'Se déconnecter' },
      sourceDoc: { '@@locale': 'en', '@@context': 'Shop app', '@@author': 'Team', signOut: 'Sign out' },
      targetDoc: { '@@locale': 'fr', '@@author': 'Équipe FR', signOut: 'Déconnexion' },
      locale: 'fr',
    }));
    assert.deepEqual(out, { '@@locale': 'fr', '@@context': 'Shop app', '@@author': 'Équipe FR', signOut: 'Se déconnecter' });
  });

  it('heals damaged metadata and @@locale from an earlier JSON sync; keeps target-only keys', () => {
    const damaged = {
      '@@locale': 'én',
      helloWorld: 'Bonjour {name} !',
      '@helloWorld': { description: 'Salutation', placeholders: { name: { type: 'Chaîne' } } },
      legacyKey: 'Ancienne clé',
      '@legacyKey': { description: 'kept' },
    };
    const out = JSON.parse(serializeARB({
      flat: { helloWorld: 'Bonjour {name} !', legacyKey: 'Ancienne clé' },
      sourceDoc: EN, targetDoc: damaged, locale: 'fr',
    }));
    assert.equal(out['@@locale'], 'fr');
    assert.deepEqual(out['@helloWorld'], EN['@helloWorld']);
    assert.equal(out.legacyKey, 'Ancienne clé');
    assert.deepEqual(out['@legacyKey'], { description: 'kept' });
  });

  it('round-trips through writeLocaleFile: messages translated, everything else untouched', () => {
    const src = write('l10n/app_en.arb', EN);
    const tgt = path.join(dir, 'l10n', 'app_fr.arb');
    writeLocaleFile(tgt, { helloWorld: 'Bonjour {name} !', signOut: 'Se déconnecter' }, 'arb', undefined, null,
      { sourcePath: src, locale: 'fr' });
    const out = read('l10n/app_fr.arb');
    assert.equal(out['@@locale'], 'fr');
    assert.deepEqual(out['@helloWorld'], EN['@helloWorld']);
    assert.deepEqual(readLocaleFile(tgt, 'arb'), { helloWorld: 'Bonjour {name} !', signOut: 'Se déconnecter' });
    // Without a source (xliff import / autofix) the file is its own template.
    writeLocaleFile(tgt, { helloWorld: 'Salut {name} !', signOut: 'Se déconnecter' }, 'arb', undefined, null, {});
    assert.equal(read('l10n/app_fr.arb').helloWorld, 'Salut {name} !');
    assert.equal(read('l10n/app_fr.arb')['@@locale'], 'fr');
  });

  it('refuses to read .arb files as plain JSON (that is how @@locale and metadata got translated)', () => {
    write('lib/l10n/app_en.arb', EN);
    assert.throws(() => discoverLocaleLayout({
      inputLocale: 'en', localesPattern: path.join(dir, 'lib/l10n/app_{lang}.arb'), format: 'json',
    }), /"format": "json" would translate the @@locale and @key metadata/);
  });

  it('a target file is created as {"@@locale": <target>}', () => {
    write('lib/l10n/app_en.arb', EN);
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesPattern: path.join(dir, 'lib/l10n/app_{lang}.arb') });
    const { created } = createMissingTargetFiles(layout, ['zh_Hant']);
    assert.deepEqual(created.map(f => f.rel), ['app_zh_Hant.arb']);
    assert.deepEqual(read('lib/l10n/app_zh_Hant.arb'), { '@@locale': 'zh_Hant' });
    assert.deepEqual(readLocaleFlat(layout.fileFor('zh_Hant')), {});
  });

  it('source descriptions ride expectedForTarget as prompt context, with no key mapping', () => {
    write('lib/l10n/app_en.arb', EN);
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesPattern: path.join(dir, 'lib/l10n/app_{lang}.arb') });
    const [unit] = loadSourceUnits(layout);
    const { flat, expansion } = expectedForTarget(unit, 'en', 'fr');
    assert.equal(flat, unit.flat);
    assert.equal(expansion.descriptions.helloWorld, 'Greeting on the home screen');
    assert.deepEqual(expansion.origin, {});
  });
});

// -----------------------------------------------------------------
// init helper
// -----------------------------------------------------------------
describe('detectFlutterL10n — the layout `init` should write for a Flutter app', () => {
  it('reads Flutter defaults (lib/l10n/app_en.arb)', () => {
    write('pubspec.yaml', 'name: demo\ndependencies:\n  flutter:\n    sdk: flutter\n');
    write('lib/l10n/app_en.arb', EN);
    write('lib/l10n/app_de.arb', { '@@locale': 'de' });
    const d = detectFlutterL10n(dir);
    assert.equal(d.framework, 'Flutter');
    assert.equal(d.localesPattern, 'lib/l10n/app_{lang}.arb');
    assert.equal(d.inputLocale, 'en');
    assert.equal(d.templateExists, true);
    assert.deepEqual(d.targets, ['de']);
  });

  it('honours l10n.yaml arb-dir and template-arb-file', () => {
    write('pubspec.yaml', 'name: demo\nflutter:\n  generate: true\n');
    write('l10n.yaml', 'arb-dir: assets/i18n\ntemplate-arb-file: intl_pt_BR.arb\noutput-localization-file: l.dart\n');
    write('assets/i18n/intl_pt_BR.arb', { a: 'A' });
    const d = detectFlutterL10n(dir);
    assert.equal(d.localesPattern, 'assets/i18n/intl_{lang}.arb');
    assert.equal(d.inputLocale, 'pt_BR');
    assert.equal(d.l10nYaml, true);
  });

  it('is null for a project that is not Flutter', () => {
    assert.equal(detectFlutterL10n(dir), null);
    write('pubspec.yaml', 'name: dart_cli\n');
    assert.equal(detectFlutterL10n(dir), null);
  });
});

// -----------------------------------------------------------------
// Sync end to end
// -----------------------------------------------------------------
class FakeFlutter extends TranslationMethod {
  constructor() { super('test-arb-fake'); }
  async translate(keys, sourceFlat, pairConfig, options) {
    FakeFlutter.calls.push({ keys: [...keys], target: pairConfig.target, descriptions: options.descriptions || {} });
    const out = {};
    for (const k of keys) {
      const v = sourceFlat[k];
      if (k === 'itemCount') {
        // The first answer translates the ICU keywords (the reported damage).
        out[k] = FakeFlutter.mangleOnce && FakeFlutter.calls.length === 1
          ? '{cuenta, plural, =0{Ningún artículo} uno{1 artículo} otro{{cuenta} artículos}}'
          : '{count, plural, =0{Aucun article} one{1 article} other{{count} articles}}';
      } else {
        out[k] = `«${v}»`;
      }
    }
    return out;
  }
}
FakeFlutter.calls = [];
FakeFlutter.mangleOnce = false;
METHOD_REGISTRY['test-arb-fake'] = FakeFlutter;

describe('sync — a Flutter project (lib/l10n/app_{lang}.arb)', () => {
  let logLines;
  let origLog;
  let origErr;
  let origWrite;

  beforeEach(() => {
    write('lib/l10n/app_en.arb', EN);
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesPattern: 'lib/l10n/app_{lang}.arb',
      defaultMethod: 'test-arb-fake', languages: ['fr', 'pt-BR'],
    }, null, 2));
    FakeFlutter.calls = [];
    FakeFlutter.mangleOnce = false;
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
  });

  it('sends only messages, writes a buildable file, and a second sync is a no-op', async () => {
    const r = await runSync({ cwd: dir, cliArgs: {} });
    assert.equal(r.totalFailed, 0);
    assert.equal(r.verifyErrors, 0, logLines.join('\n'));
    const sent = FakeFlutter.calls.flatMap(c => c.keys);
    assert.ok(sent.every(k => !k.startsWith('@')), `metadata was never sent: ${sent}`);
    assert.equal(FakeFlutter.calls[0].descriptions.helloWorld, 'Greeting on the home screen');

    const fr = read('lib/l10n/app_fr.arb');
    assert.deepEqual(Object.keys(fr), ['@@locale', 'helloWorld', '@helloWorld', 'itemCount', '@itemCount', 'signOut']);
    assert.equal(fr['@@locale'], 'fr');
    assert.deepEqual(fr['@itemCount'], EN['@itemCount']);
    assert.equal(fr.itemCount, '{count, plural, =0{Aucun article} one{1 article} other{{count} articles}}');
    assert.equal(read('lib/l10n/app_pt-BR.arb')['@@locale'], 'pt_BR');

    FakeFlutter.calls = [];
    const again = await runSync({ cwd: dir, cliArgs: {} });
    assert.equal(again.totalProcessed, 0);
    assert.equal(FakeFlutter.calls.length, 0);
  });

  it('translated ICU keywords are refused by the gate and retried — never written', async () => {
    FakeFlutter.mangleOnce = true;
    const r = await runSync({ cwd: dir, cliArgs: { pair: 'en:fr' } });
    assert.equal(r.totalFailed, 0);
    assert.equal(read('lib/l10n/app_fr.arb').itemCount,
      '{count, plural, =0{Aucun article} one{1 article} other{{count} articles}}');
    const retry = FakeFlutter.calls[1];
    assert.deepEqual(retry.keys, ['itemCount']);
    assert.match(retry.descriptions.itemCount, /RETRY: .*ICU variable 'count' was translated to 'cuenta'/);
  });

  it('verify and integrity report what an older JSON sync broke: ICU keywords, @@locale, placeholder types', async () => {
    await runSync({ cwd: dir, cliArgs: {} });
    const damaged = read('lib/l10n/app_fr.arb');
    damaged['@@locale'] = 'én';
    damaged['@helloWorld'] = { description: 'Salutation', placeholders: { name: { type: 'Chaîne' } } };
    damaged.itemCount = '{cuenta, plural, =0{Ningún artículo} uno{1 artículo} otro{{cuenta} artículos}}';
    write('lib/l10n/app_fr.arb', damaged);

    logLines = [];
    const v = await verifyLocales(resolveConfig({}, dir), dir);
    assert.ok(v.errors >= 2, logLines.join('\n'));
    const text = logLines.join('\n');
    assert.match(text, /\[VERIFY\] fr: 1 ICU structure error\(s\): itemCount/);
    assert.match(text, /@@locale is "én" — expected "fr"/);
    assert.match(text, /placeholder metadata of "helloWorld" differs from the source/);

    assert.equal(auditARBDocument(path.join(dir, 'lib/l10n/app_en.arb'), path.join(dir, 'lib/l10n/app_fr.arb'), 'fr').length, 2);

    logLines = [];
    const code = await runIntegrity({ json: true }, dir);
    assert.equal(code, 1);
    const fr = JSON.parse(logLines.join('\n')).locales.find(l => l.locale === 'fr');
    assert.equal(fr.issues.icuIssues.length, 1);
    assert.equal(fr.issues.documentIssues.length, 2);

    // Any sync that rewrites the file repairs the document. The damaged
    // message was written into the file by hand here (it is not what sync
    // wrote, and the cache never held it), so a bulk redo keeps it as a
    // person's text (lib/locale-state.js) — the repair verify names, which
    // NAMES the key, replaces it.
    await runSync({ cwd: dir, cliArgs: { pair: 'en:fr', force: true, 'no-verify': true } });
    let healed = read('lib/l10n/app_fr.arb');
    assert.equal(healed['@@locale'], 'fr');
    assert.deepEqual(healed['@helloWorld'], EN['@helloWorld']);
    assert.equal(healed.itemCount, damaged.itemCount, 'a bulk redo keeps a value a person wrote');
    await runSync({ cwd: dir, cliArgs: { pair: 'en:fr', 'force-keys': 'itemCount', 'no-verify': true } });
    healed = read('lib/l10n/app_fr.arb');
    assert.equal(healed.itemCount, '{count, plural, =0{Aucun article} one{1 article} other{{count} articles}}');
  });
});
