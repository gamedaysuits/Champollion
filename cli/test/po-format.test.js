/**
 * gettext catalogs (lib/po.js, lib/format.js, lib/locale-layout.js).
 *
 * WHAT MUST HOLD:
 *   - keys are msgids; a context is folded in as `msgctxt\u0004msgid`
 *     (gettext's own encoding), so "Open" the verb and "Open" the adjective
 *     are separate keys AND separate Translation Memory entries;
 *   - a source catalog (.pot, or `makemessages -l en`) reads msgid where
 *     msgstr is empty; a target reads only translated, non-fuzzy entries;
 *   - a plural entry is one ICU plural message; the writer maps each CLDR
 *     category onto msgstr[i] through the TARGET's Plural-Forms header, or
 *     a header derived from CLDR and verified against Intl.PluralRules;
 *   - untouched entries are written back byte for byte; a translated entry
 *     loses `fuzzy` and its `#|` lines, keeps translator comments, takes
 *     the source's references; obsolete and target-only entries are kept.
 *
 * Run: node --test test/po-format.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  readPO, writePO, emptyPO, parsePO, compilePluralExpression, parsePluralForms, synthesizePluralForms,
  pluralIndexSelectors, PO_CONTEXT_SEPARATOR,
} from '../lib/po.js';
import { readLocaleFile, writeLocaleFile, detectFormat, detectFormatFromDir } from '../lib/format.js';
import {
  discoverLocaleLayout, readLocaleFlat, loadSourceUnits, keysForNamespace, detectGettextLayout,
} from '../lib/locale-layout.js';
import { METHOD_REGISTRY } from '../lib/translate.js';
import { TranslationMethod } from '../lib/methods/base.js';
import { runSync } from '../lib/sync.js';
import { loadTM, lookupTM, tmMethodKey } from '../lib/tm.js';
import { resolveConfig } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';
import { output } from '../lib/output.js';

const C = PO_CONTEXT_SEPARATOR;

const POT = `# SOME DESCRIPTIVE TITLE.
#, fuzzy
msgid ""
msgstr ""
"Project-Id-Version: demo 1.0\\n"
"Content-Type: text/plain; charset=CHARSET\\n"
"Plural-Forms: nplurals=INTEGER; plural=EXPRESSION;\\n"

#. Dashboard greeting
#: app/views.py:12
#, python-format
msgid "Welcome back, %(name)s!"
msgstr ""

#: app/views.py:20
msgctxt "verb"
msgid "Open"
msgstr ""

#: app/views.py:21
msgctxt "adjective"
msgid "Open"
msgstr ""

#: app/views.py:30
#, python-format
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] ""
msgstr[1] ""

#: app/views.py:40
msgid ""
"Line one\\n"
"Line \\"two\\""
msgstr ""
`;

const FR = `# French translation of demo.
# Jane Doe <jane@example.org>, 2026.
msgid ""
msgstr ""
"Language: fr\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n > 1);\\n"

# Reviewed by Jane
#. Dashboard greeting
#: app/views.py:11
#, python-format
msgid "Welcome back, %(name)s!"
msgstr "Bon retour, %(name)s !"

# Needs a second look
#: app/views.py:19
#, fuzzy
#| msgctxt "verb"
#| msgid "Opens"
msgctxt "verb"
msgid "Open"
msgstr "Ouvre"

#: app/old.py:3
msgid "Gone from the template"
msgstr "Disparu du modèle"

#~ msgid "Old string"
#~ msgstr "Vieille chaîne"
`;

// -----------------------------------------------------------------
// Reading
// -----------------------------------------------------------------
describe('readPO — keys, source and target sides', () => {
  it('a template reads msgid as the source text; msgctxt is folded into the key', () => {
    const { flat, context } = readPO(POT, { role: 'source' });
    assert.deepEqual(flat, {
      'Welcome back, %(name)s!': 'Welcome back, %(name)s!',
      [`verb${C}Open`]: 'Open',
      [`adjective${C}Open`]: 'Open',
      'One file': '{n, plural, one {One file} other {%(count)d files}}',
      'Line one\nLine "two"': 'Line one\nLine "two"',
    });
    assert.equal(context['Welcome back, %(name)s!'], 'Dashboard greeting');
    assert.equal(context[`verb${C}Open`], 'Context (msgctxt): verb');
    assert.match(context['One file'], /gettext plural message/);
  });

  it('a source-language catalog with filled msgstr uses them', () => {
    const po = 'msgid ""\nmsgstr ""\n"Language: en\\n"\n\nmsgid "nav.home"\nmsgstr "Home page"\n';
    assert.deepEqual(readPO(po, { role: 'source' }).flat, { 'nav.home': 'Home page' });
  });

  it('a target reads only translated, non-fuzzy entries; plurals map through its Plural-Forms', () => {
    const po = `${FR}
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "Un fichier"
msgstr[1] "%(count)d fichiers"

msgid "Untranslated"
msgstr ""
`;
    assert.deepEqual(readPO(po, { role: 'target', locale: 'fr' }).flat, {
      'Welcome back, %(name)s!': 'Bon retour, %(name)s !',
      'Gone from the template': 'Disparu du modèle',
      'One file': '{n, plural, one {Un fichier} other {%(count)d fichiers}}',
    });
  });

  it('Russian forms map to one/few/many, and ICU gets `other` (the general form)', () => {
    const po = `msgid ""
msgstr ""
"Language: ru\\n"
"Plural-Forms: nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);\\n"

msgid "One file"
msgid_plural "%d files"
msgstr[0] "%d файл"
msgstr[1] "%d файла"
msgstr[2] "%d файлов"
`;
    assert.equal(readPO(po, { locale: 'ru' }).flat['One file'],
      '{n, plural, one {%d файл} few {%d файла} many {%d файлов} other {%d файлов}}');
  });

  it('a form count that disagrees with Plural-Forms is untranslated (msgfmt would reject it)', () => {
    const po = 'msgid ""\nmsgstr ""\n"Plural-Forms: nplurals=3; plural=(n==1 ? 0 : n<5 ? 1 : 2);\\n"\n\n'
      + 'msgid "a"\nmsgid_plural "as"\nmsgstr[0] "x"\nmsgstr[1] "y"\n';
    assert.deepEqual(readPO(po, { locale: 'cs' }).flat, {});
  });

  it('a plural msgid whose braces do not balance is reported and not translated', () => {
    const po = 'msgid ""\nmsgstr ""\n\nmsgid "Press { once"\nmsgid_plural "Press { %d times"\nmsgstr[0] ""\nmsgstr[1] ""\n';
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(' '));
    try {
      assert.deepEqual(readPO(po, { role: 'source', filePath: 'x.pot' }).flat, {});
    } finally {
      console.warn = origWarn;
    }
    assert.ok(warnings.some(w => /unbalanced braces .* NOT translated/.test(w)), warnings.join('\n'));
  });

  it('refuses a non-UTF-8 catalog with the msgconv command', () => {
    const po = 'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=ISO-8859-1\\n"\n';
    assert.throws(() => readPO(po, { filePath: 'fr.po' }), /charset ISO-8859-1 .* msgconv --to-code=UTF-8/);
  });

  it('format detection knows .po, .pot and .arb', () => {
    assert.equal(detectFormat('locale/fr/LC_MESSAGES/django.po'), 'po');
    assert.equal(detectFormat('po/messages.pot'), 'po');
    assert.equal(detectFormat('lib/l10n/app_fr.arb'), 'arb');
  });
});

// -----------------------------------------------------------------
// Writing
// -----------------------------------------------------------------
describe('writePO — lossless for untouched entries', () => {
  it('rewriting a catalog with nothing changed is byte-identical', () => {
    const flat = readPO(FR, { locale: 'fr' }).flat;
    assert.equal(writePO({ flat, sourceText: null, targetText: FR, locale: 'fr' }), FR);
    const crlf = FR.replace(/\n/g, '\r\n');
    assert.equal(writePO({ flat, sourceText: null, targetText: crlf, locale: 'fr' }), crlf, 'CRLF kept');
  });

  it('translates in the template\'s order: fuzzy cleared, #| dropped, comments kept, untouched raw', () => {
    const flat = {
      ...readPO(FR, { locale: 'fr' }).flat,
      [`verb${C}Open`]: 'Ouvrir',
      'One file': '{n, plural, one {Un fichier} many {%(count)d de fichiers} other {%(count)d fichiers}}',
    };
    const out = writePO({ flat, sourceText: POT, targetText: FR, locale: 'fr' });
    const blocks = out.split('\n\n');
    assert.ok(out.includes('# Reviewed by Jane\n#. Dashboard greeting\n#: app/views.py:11\n'),
      'an untouched entry keeps its own (older) reference — byte for byte');
    const verb = blocks.find(b => b.includes('msgctxt "verb"'));
    assert.equal(verb, '# Needs a second look\n#: app/views.py:20\nmsgctxt "verb"\nmsgid "Open"\nmsgstr "Ouvrir"');
    const plural = blocks.find(b => b.includes('msgid_plural'));
    assert.match(plural, /#, python-format\nmsgid "One file"\nmsgid_plural "%\(count\)d files"\nmsgstr\[0\] "Un fichier"\nmsgstr\[1\] "%\(count\)d fichiers"$/);
    assert.ok(blocks.some(b => b === '#: app/views.py:21\nmsgctxt "adjective"\nmsgid "Open"\nmsgstr ""'),
      'an untranslated entry is written with an empty msgstr');
    assert.ok(blocks.some(b => b.startsWith('#: app/views.py:40\nmsgid ""\n"Line one\\n"\n"Line \\"two\\""')));
    assert.ok(out.includes('msgid "Gone from the template"'), 'target-only entries are kept');
    assert.ok(out.trimEnd().endsWith('#~ msgid "Old string"\n#~ msgstr "Vieille chaîne"'), 'obsolete entries kept, last');
    assert.ok(out.indexOf('msgctxt "verb"') < out.indexOf('msgctxt "adjective"'));
    // And it reads back.
    const back = readPO(out, { locale: 'fr' }).flat;
    assert.equal(back[`verb${C}Open`], 'Ouvrir');
    assert.equal(back['One file'], '{n, plural, one {Un fichier} other {%(count)d fichiers}}');
  });

  it('a new target gets the Plural-Forms msginit writes for its language (Round 6: not CLDR\'s, where msginit has one)', () => {
    const out = writePO({
      flat: { 'One file': '{n, plural, one {%(count)d файл} few {%(count)d файла} many {%(count)d файлов} other {%(count)d файла}}' },
      sourceText: POT, targetText: null, locale: 'ru',
    });
    assert.match(out, /^msgid ""\nmsgstr ""\n"Project-Id-Version: demo 1\.0\\n"\n/);
    assert.match(out, /"Language: ru\\n"/);
    assert.match(out, /"Plural-Forms: nplurals=3; plural=\(n%10==1 && n%100!=11 \? 0 : n%10>=2 && n%10<=4 && \(n%100<10 \|\| n%100>=20\) \? 1 : 2\);\\n"/);
    assert.match(out, /msgstr\[0\] "%\(count\)d файл"\nmsgstr\[1\] "%\(count\)d файла"\nmsgstr\[2\] "%\(count\)d файлов"/);
    assert.ok(!/fuzzy/.test(out.split('\n\n')[0]), 'the generated header is not fuzzy');
  });

  it('a placeholder Plural-Forms / charset=CHARSET in the target header is replaced', () => {
    const target = 'msgid ""\nmsgstr ""\n"Language: de\\n"\n"Content-Type: text/plain; charset=CHARSET\\n"\n'
      + '"Plural-Forms: nplurals=INTEGER; plural=EXPRESSION;\\n"\n';
    const out = writePO({ flat: { 'One file': '{n, plural, one {Eine Datei} other {%(count)d Dateien}}' }, sourceText: POT, targetText: target, locale: 'de' });
    assert.match(out, /charset=UTF-8/);
    assert.match(out, /"Plural-Forms: nplurals=2; plural=\(n != 1\);\\n"/);
    assert.match(out, /msgstr\[0\] "Eine Datei"\nmsgstr\[1\] "%\(count\)d Dateien"/);
  });

  it('French gets msginit\'s two forms; a language msginit does not list still gets a CLDR-derived header', () => {
    const fr = writePO({ flat: { 'One file': '{n, plural, one {Un fichier} many {%(count)d de fichiers} other {%(count)d fichiers}}' }, sourceText: POT, targetText: null, locale: 'fr' });
    assert.match(fr, /"Plural-Forms: nplurals=2; plural=\(n > 1\);\\n"/);
    assert.match(fr, /msgstr\[0\] "Un fichier"\nmsgstr\[1\] "%\(count\)d fichiers"/);
    assert.doesNotMatch(fr, /# champollion:/, 'no slot for "many": nothing to mark');
    assert.match(emptyPO('pt-BR'), /"Plural-Forms: nplurals=2; plural=\(n > 1\);\\n"/);
    assert.match(emptyPO('pt-PT'), /"Plural-Forms: nplurals=2; plural=\(n != 1\);\\n"/);
    // Welsh: not in msginit's table — CLDR's six forms, verified.
    assert.match(emptyPO('cy'), /"Plural-Forms: nplurals=6; /);
  });

  it('without a locale argument the catalog\'s own Language header decides the plural forms', () => {
    const ru = 'msgid ""\nmsgstr ""\n"Language: ru\\n"\n\nmsgid "One file"\nmsgid_plural "%d files"\nmsgstr[0] ""\nmsgstr[1] ""\nmsgstr[2] ""\n';
    const out = writePO({ flat: { 'One file': '{n, plural, one {%d файл} few {%d файла} many {%d файлов} other {%d файла}}' }, sourceText: null, targetText: ru, locale: null });
    assert.match(out, /msgstr\[0\] "%d файл"\nmsgstr\[1\] "%d файла"\nmsgstr\[2\] "%d файлов"/);
    assert.match(out, /"Plural-Forms: nplurals=3; /, 'the missing header field is added');
  });

  it('an empty target is a header only', () => {
    const out = emptyPO('pl');
    assert.equal(parsePO(out).entries.length, 1);
    assert.match(out, /"Plural-Forms: nplurals=3; /);
    assert.deepEqual(readPO(out, { locale: 'pl' }).flat, {});
  });
});

// -----------------------------------------------------------------
// The header of a catalog champollion creates (synthetic Django persona,
// 2026-10: `msgfmt -c` warned about four missing standard fields).
// -----------------------------------------------------------------
describe('a created catalog carries the standard gettext header (as msginit --no-translator writes it)', () => {
  const NOW = new Date(2026, 9, 3, 15, 43);
  const fields = (text) => Object.fromEntries(
    parsePO(text).header.msgstr[0].split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
  const DJANGO_EN = 'msgid ""\nmsgstr ""\n"Project-Id-Version: PACKAGE VERSION\\n"\n"Report-Msgid-Bugs-To: \\n"\n'
    + '"POT-Creation-Date: 2026-10-01 12:00+0000\\n"\n"Content-Type: text/plain; charset=UTF-8\\n"\n\nmsgid "Hello"\nmsgstr ""\n';

  it('every standard field, with honest values — no invented translator', () => {
    const h = fields(emptyPO('fr', { sourceText: POT, projectName: 'mysite', now: NOW }));
    assert.equal(h['Project-Id-Version'], 'demo 1.0', 'a real template value is kept');
    assert.equal(h['Report-Msgid-Bugs-To'], '');
    assert.equal(h['POT-Creation-Date'], undefined, 'the template has no date — none is invented');
    assert.match(h['PO-Revision-Date'], /^2026-10-03 15:43[+-]\d{4}$/);
    assert.equal(h['Last-Translator'], 'Automatically generated');
    assert.equal(h['Language-Team'], 'none');
    assert.equal(h.Language, 'fr');
    assert.equal(h['MIME-Version'], '1.0');
    assert.equal(h['Content-Type'], 'text/plain; charset=UTF-8');
    assert.equal(h['Content-Transfer-Encoding'], '8bit');
    assert.match(h['Plural-Forms'], /^nplurals=\d+; plural=.+;$/);
  });

  it('copies the template\'s dates and bug address; xgettext\'s PACKAGE VERSION becomes the project name', () => {
    const h = fields(emptyPO('de', { sourceText: DJANGO_EN, projectName: 'mysite', now: NOW }));
    assert.equal(h['Project-Id-Version'], 'mysite');
    assert.equal(h['POT-Creation-Date'], '2026-10-01 12:00+0000');
    // The same header when sync creates the catalog with entries in it.
    const viaSync = fields(writePO({ flat: { Hello: 'Hallo' }, sourceText: DJANGO_EN, targetText: null, locale: 'de', projectName: 'mysite', now: NOW }));
    assert.deepEqual(viaSync, h);
  });

  it('an existing catalog\'s header is never rewritten', () => {
    const target = 'msgid ""\nmsgstr ""\n"Language: fr\\n"\n"Plural-Forms: nplurals=2; plural=(n > 1);\\n"\n\nmsgid "Hello"\nmsgstr ""\n';
    const out = writePO({ flat: { Hello: 'Bonjour' }, sourceText: DJANGO_EN, targetText: target, locale: 'fr', projectName: 'mysite', now: NOW });
    assert.ok(out.startsWith('msgid ""\nmsgstr ""\n"Language: fr\\n"\n"Plural-Forms: nplurals=2; plural=(n > 1);\\n"\n\n'), out);
  });

  it('msgfmt -c accepts it without a warning (when gettext is installed)', (t) => {
    const probe = spawnSync('msgfmt', ['--version'], { encoding: 'utf-8' });
    if (probe.error || probe.status !== 0) { t.skip('msgfmt is not installed here'); return; }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'po-header-'));
    for (const [name, text] of [
      ['empty.po', emptyPO('fr', { sourceText: DJANGO_EN, projectName: 'mysite', now: NOW })],
      ['synced.po', writePO({ flat: { Hello: 'Bonjour' }, sourceText: DJANGO_EN, targetText: null, locale: 'fr', projectName: 'mysite', now: NOW })],
    ]) {
      const file = path.join(dir, name);
      fs.writeFileSync(file, text);
      const r = spawnSync('msgfmt', ['-c', '-o', '/dev/null', file], { encoding: 'utf-8' });
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stderr.trim(), '', `${name}: ${r.stderr}`);
    }
  });
});

// -----------------------------------------------------------------
// Plural-Forms
// -----------------------------------------------------------------
describe('Plural-Forms — evaluate, derive from CLDR, map indexes to categories', () => {
  it('evaluates gettext expressions (precedence, ternaries, !)', () => {
    const ru = compilePluralExpression('n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2');
    assert.deepEqual([1, 2, 5, 11, 21, 22, 25, 111, 112].map(ru), [0, 1, 2, 2, 0, 1, 2, 2, 2]);
    assert.equal(compilePluralExpression('!(n == 1)')(1), 0);
    assert.equal(parsePluralForms('nplurals=INTEGER; plural=EXPRESSION;'), null);
    assert.equal(parsePluralForms('nplurals=2; plural=(n > 1);').nplurals, 2);
    assert.equal(parsePluralForms('nplurals=2; plural=n+5;'), null, 'an index out of range is invalid');
  });

  it('derived expressions agree with Intl.PluralRules for every integer probed', () => {
    for (const locale of ['en', 'fr', 'es', 'pt', 'ru', 'uk', 'pl', 'cs', 'ar', 'he', 'lt', 'lv', 'ga', 'cy', 'ja', 'zh', 'sl', 'ro', 'is', 'mt']) {
      const synth = synthesizePluralForms(locale);
      assert.ok(synth, `${locale}: derivable`);
      const rules = new Intl.PluralRules(locale);
      for (const n of [...Array(1200).keys(), 1000000, 2000000, 1000001, 10000000]) {
        assert.equal(synth.categories[synth.evaluate(n)], rules.select(n), `${locale} n=${n}`);
      }
    }
    assert.deepEqual(synthesizePluralForms('fr').categories, ['one', 'many', 'other'],
      'French gets CLDR\'s many (millions), as Babel writes since CLDR 42');
    assert.equal(synthesizePluralForms('xx-unknown'), null);
  });

  it('maps the indexes of classic gettext headers onto CLDR categories', () => {
    const ar = parsePluralForms('nplurals=6; plural=n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5;');
    assert.deepEqual(pluralIndexSelectors(ar.nplurals, ar.evaluate, 'ar'), ['zero', 'one', 'two', 'few', 'many', 'other']);
    // Latvian's traditional order is not CLDR's: [one, other, zero].
    const lv = parsePluralForms('nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n != 0 ? 1 : 2);');
    assert.deepEqual(pluralIndexSelectors(lv.nplurals, lv.evaluate, 'lv'), ['one', 'other', 'zero']);
    const fr = parsePluralForms('nplurals=2; plural=(n > 1);');
    assert.deepEqual(pluralIndexSelectors(fr.nplurals, fr.evaluate, 'fr'), ['one', 'other']);
  });
});

// -----------------------------------------------------------------
// Layouts and templates
// -----------------------------------------------------------------
describe('gettext layouts — the source may be a .pot template', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-po-layout-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });
  const put = (rel, text) => {
    const p = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
    return p;
  };

  it('GNU po/: the one .pot is the source; .po files are the targets', () => {
    put('po/hello.pot', POT);
    put('po/fr.po', FR);
    assert.equal(detectFormatFromDir(path.join(dir, 'po')), 'po');
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesDir: path.join(dir, 'po') });
    assert.equal(layout.format, 'po');
    assert.equal(layout.sourceFiles[0].template, true);
    assert.equal(layout.sourceFiles[0].rel, 'hello.pot');
    assert.deepEqual(layout.listLocales(), ['fr']);
    assert.equal(layout.fileFor('fr').sourcePath, path.join(dir, 'po', 'hello.pot'));
    assert.equal(loadSourceUnits(layout)[0].flat['One file'], '{n, plural, one {One file} other {%(count)d files}}');
  });

  it('two templates and no source catalog is an error, not a guess', () => {
    put('po/a.pot', POT);
    put('po/b.pot', POT);
    assert.throws(() => discoverLocaleLayout({ inputLocale: 'en', localesDir: path.join(dir, 'po'), format: 'po' }),
      /several gettext templates .*a\.pot, b\.pot/);
  });

  it('Babel: translations/{lang}/LC_MESSAGES/messages.po + translations/messages.pot', () => {
    put('translations/messages.pot', POT);
    put('translations/de/LC_MESSAGES/messages.po', 'msgid ""\nmsgstr ""\n"Language: de\\n"\n');
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesPattern: path.join(dir, 'translations/{lang}/LC_MESSAGES/messages.po') });
    assert.equal(layout.sourceFiles[0].path, path.join(dir, 'translations', 'messages.pot'));
    assert.deepEqual(layout.listLocales(), ['de']);
  });

  it('Django with {ns}: a source catalog per domain, or <domain>.pot templates', () => {
    put('locale/django.pot', POT);
    put('locale/djangojs.pot', 'msgid ""\nmsgstr ""\n\nmsgid "Save"\nmsgstr ""\n');
    const layout = discoverLocaleLayout({ inputLocale: 'en', localesPattern: path.join(dir, 'locale/{lang}/LC_MESSAGES/{ns}.po') });
    assert.deepEqual(layout.sourceFiles.map(f => f.ns), ['django', 'djangojs']);
    assert.equal(layout.fileFor('fr', 'djangojs').path, path.join(dir, 'locale', 'fr', 'LC_MESSAGES', 'djangojs.po'));
  });

  it('detectGettextLayout reports the config for a Django project', () => {
    put('manage.py', '');
    put('locale/en/LC_MESSAGES/django.po', POT.replace('charset=CHARSET', 'charset=UTF-8'));
    put('locale/fr/LC_MESSAGES/django.po', FR);
    const d = detectGettextLayout(dir);
    assert.equal(d.framework, 'Django');
    assert.equal(d.localesPattern, 'locale/{lang}/LC_MESSAGES/{ns}.po');
    assert.deepEqual(d.sourceFiles, ['locale/en/LC_MESSAGES/django.po']);
    assert.deepEqual(d.targets, ['fr']);
  });

  it('--force-keys accepts the printed form of a context key (verb␄Open)', () => {
    assert.deepEqual(keysForNamespace({ namespaced: false }, ['verb␄Open'], ''), [`verb${C}Open`]);
    assert.deepEqual(keysForNamespace({ namespaced: true }, ['django::verb␄Open'], 'django'), [`verb${C}Open`]);
  });

  it('readLocaleFile/writeLocaleFile route po through the same reader/writer (xliff, autofix)', () => {
    const p = put('fr.po', FR);
    const flat = readLocaleFile(p, 'po', { locale: 'fr' });
    flat['Gone from the template'] = 'Toujours là';
    writeLocaleFile(p, flat, 'po', flat, null, { locale: 'fr' });
    const text = fs.readFileSync(p, 'utf-8');
    assert.match(text, /msgid "Gone from the template"\nmsgstr "Toujours là"/);
    assert.ok(text.includes('# Reviewed by Jane'), 'everything else untouched');
    assert.equal(readLocaleFlat({ path: p, format: 'po', code: 'fr', role: 'target', rel: 'fr.po' })['Gone from the template'], 'Toujours là');
  });
});

// -----------------------------------------------------------------
// Sync end to end (Django layout)
// -----------------------------------------------------------------
class FakeGettext extends TranslationMethod {
  constructor() { super('test-po-fake'); }
  async translate(keys, sourceFlat, pairConfig, options) {
    FakeGettext.calls.push({ keys: [...keys], target: pairConfig.target, descriptions: options.descriptions || {} });
    const out = {};
    for (const k of keys) {
      const src = sourceFlat[k];
      const ctx = options.descriptions?.[k] || '';
      if (src.startsWith('{n, plural')) {
        out[k] = pairConfig.target === 'ru'
          ? '{n, plural, one {%(count)d файл} few {%(count)d файла} many {%(count)d файлов} other {%(count)d файла}}'
          : '{n, plural, one {Un fichier} many {%(count)d de fichiers} other {%(count)d fichiers}}';
      } else if (src === 'Open') {
        out[k] = /verb/.test(ctx) ? `${pairConfig.target}:Ouvrir` : `${pairConfig.target}:Ouvert`;
      } else {
        out[k] = `${pairConfig.target}⟨${src}⟩`;
      }
    }
    return out;
  }
}
FakeGettext.calls = [];
METHOD_REGISTRY['test-po-fake'] = FakeGettext;

describe('sync — a Django project (locale/{lang}/LC_MESSAGES/{ns}.po)', () => {
  let dir;
  let origLog;
  let origErr;
  let origWrite;
  let logLines;
  const put = (rel, text) => {
    const p = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  };
  const catalog = (lang) => fs.readFileSync(path.join(dir, 'locale', lang, 'LC_MESSAGES', 'django.po'), 'utf-8');

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-po-sync-'));
    // `django-admin makemessages -l en`: the source catalog, msgstr empty.
    put('locale/en/LC_MESSAGES/django.po', POT.replace('charset=CHARSET', 'charset=UTF-8')
      .replace('"Plural-Forms: nplurals=INTEGER; plural=EXPRESSION;\\n"', '"Plural-Forms: nplurals=2; plural=(n != 1);\\n"'));
    put('locale/fr/LC_MESSAGES/django.po', FR);
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesPattern: 'locale/{lang}/LC_MESSAGES/{ns}.po',
      defaultMethod: 'test-po-fake', languages: ['fr', 'ru'],
    }, null, 2));
    FakeGettext.calls = [];
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
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('translates what is missing or fuzzy, keeps the rest, and creates the Russian catalog', async () => {
    const r = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(r.totalFailed, 0, logLines.join('\n'));

    const fr = catalog('fr');
    assert.ok(fr.includes('# Reviewed by Jane\n#. Dashboard greeting\n#: app/views.py:11\n#, python-format\nmsgid "Welcome back, %(name)s!"\nmsgstr "Bon retour, %(name)s !"'),
      'the existing translation is untouched');
    assert.match(fr, /# Needs a second look\n#: app\/views\.py:20\nmsgctxt "verb"\nmsgid "Open"\nmsgstr "fr:Ouvrir"/,
      'the fuzzy entry was re-translated and is no longer fuzzy');
    assert.match(fr, /msgctxt "adjective"\nmsgid "Open"\nmsgstr "fr:Ouvert"/, 'a different context, a different translation');
    assert.match(fr, /msgstr\[0\] "Un fichier"\nmsgstr\[1\] "%\(count\)d fichiers"/, 'French header: 2 forms');

    const ru = catalog('ru');
    assert.match(ru, /"Plural-Forms: nplurals=3; /);
    assert.match(ru, /msgstr\[0\] "%\(count\)d файл"\nmsgstr\[1\] "%\(count\)d файла"\nmsgstr\[2\] "%\(count\)d файлов"/);

    // The model never saw a key with U+0004 or a newline in it.
    for (const c of FakeGettext.calls) {
      for (const k of c.keys) assert.ok(!/[\u0000-\u001f]/.test(k), `aliased key sent: ${JSON.stringify(k)}`);
    }

    // The two contexts are separate Translation Memory entries.
    const tm = loadTM(dir);
    const key = tmMethodKey(resolvePairs(resolveConfig({}, dir)).get('en:fr'));
    assert.equal(lookupTM(tm, `verb${C}Open`, 'fr', key), 'fr:Ouvrir');
    assert.equal(lookupTM(tm, `adjective${C}Open`, 'fr', key), 'fr:Ouvert');

    FakeGettext.calls = [];
    const again = await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    assert.equal(again.totalProcessed, 0, 'a second sync has nothing to do');
    assert.equal(FakeGettext.calls.length, 0);
  });

  it('--force re-serves both contexts from the cache without mixing them up, and keeps the reviewer\'s entry', async () => {
    await runSync({ cwd: dir, cliArgs: { 'no-verify': true } });
    FakeGettext.calls = [];
    const r = await runSync({ cwd: dir, cliArgs: { pair: 'en:fr', force: true, 'no-verify': true } });
    // Both contexts come from the TM; the hand-translated entry ("Reviewed
    // by Jane" — never produced by the pipeline) is a person's text, which a
    // bulk redo keeps (lib/locale-state.js): nothing goes to the method.
    assert.deepEqual(FakeGettext.calls.flatMap(c => c.keys), []);
    assert.equal(r.totalKept, 1);
    let fr = catalog('fr');
    assert.match(fr, /msgctxt "verb"\nmsgid "Open"\nmsgstr "fr:Ouvrir"/);
    assert.match(fr, /msgctxt "adjective"\nmsgid "Open"\nmsgstr "fr:Ouvert"/);
    assert.match(fr, /msgstr "Bon retour, %\(name\)s !"/, 'the reviewer\'s translation is kept');
    // Naming the key replaces it — and the reviewer's wording is recorded.
    await runSync({ cwd: dir, cliArgs: { pair: 'en:fr', 'force-keys': 'Welcome back\\, %(name)s!', 'no-verify': true } });
    assert.deepEqual(FakeGettext.calls.flatMap(c => c.keys), ['Welcome back, %(name)s!']);
    fr = catalog('fr');
    assert.match(fr, /msgstr "fr⟨Welcome back, %\(name\)s!⟩"/);
    const record = fs.readFileSync(path.join(dir, '.champollion-replaced-edits.jsonl'), 'utf-8').trim().split('\n').map(l => JSON.parse(l));
    assert.equal(record.length, 1);
    assert.equal(record[0].editedValue, 'Bon retour, %(name)s !');
    assert.equal(record[0].why, 'named for a redo');
  });

  it('post-sync verification passes on a clean run and reports keys readably', async () => {
    const r = await runSync({ cwd: dir, cliArgs: { pair: 'en:fr' } });
    assert.equal(r.verifyErrors, 0, logLines.join('\n'));
  });
});
