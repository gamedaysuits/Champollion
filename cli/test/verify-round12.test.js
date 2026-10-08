/**
 * Round 12 synthetic users — three gaps in `verify`.
 *
 *   5. (i18next persona) A passing verify did not say which plural forms it
 *      expected per locale, and `verify --json` emitted one closing line, so
 *      confirming the plurals needed a separate check. Each locale now gets
 *      a plural-coverage line — the forms come from CLDR for that locale
 *      (lib/plurals.js, lib/icu-structure.js), never a list in the code — and
 *      --json one `verify` event per locale, before an unchanged closing line.
 *   6. `verify --help` cut its heading mid-sentence, and its Checks list did
 *      not say what verify checks (i18next `_one`/`_many`/`_other` keys
 *      among them; "one output repeated for several source strings" was
 *      listed as a warning — it is an error).
 *   9. (Django persona) A gettext catalog's lost `%(name)s` was reported as
 *      an "ICU structure error" in a catalog with no ICU in it. Findings are
 *      now named by the placeholder syntax involved: ICU, printf/python-format,
 *      i18next {{…}}.
 *
 * Fixtures are temp directories; the CLI is run as a child process; nothing
 * touches the network.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { COMMAND_HELP } from '../lib/command-help.js';
import { pluralCategoriesFor } from '../lib/plurals.js';
import { CLDR_CATEGORIES, pluralCategoryUse } from '../lib/icu-structure.js';
import { auditTranslations } from '../lib/verify.js';
import { findICUStructureIssues, extractPlaceholders } from '../lib/integrity.js';

const CLI = path.join(import.meta.dirname, '..', 'bin', 'cli.js');
const dirs = [];

function tmp(name) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `verify-r12-${name}-`));
  dirs.push(d);
  return d;
}
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}
function cli(args, cwd) {
  // NODE_NO_WARNINGS: Node's own runtime warnings ("(node:1234) Warning: …")
  // are not the CLI's output. One landed on stderr under the full suite's
  // load during `npm publish` and broke the NDJSON parse; the CLI itself
  // never emits warnings, and every line it writes is still checked.
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf-8', env: { ...process.env, NO_COLOR: '1', NODE_NO_WARNINGS: '1' } });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, out: `${r.stdout}\n${r.stderr}` };
}
/** CLDR's categories for a locale, in CLDR order — what the line must name. */
function cldr(locale, type = 'cardinal') {
  const cats = pluralCategoriesFor(locale, type);
  return CLDR_CATEGORIES.filter(c => cats.includes(c));
}

afterEach(() => {
  while (dirs.length > 0) fs.rmSync(dirs.pop(), { recursive: true, force: true });
});

// ── fixtures ──────────────────────────────────────────────────────────────

/** i18next JSON: `item_*` plural keys; fr written with all of French's forms. */
function i18nextProject({ fr, de } = {}) {
  const d = tmp('i18next');
  write(path.join(d, 'locales/en.json'), { item_one: '{{count}} item', item_other: '{{count}} items', hello: 'Hello {{name}}' });
  write(path.join(d, 'locales/fr.json'), fr || {
    item_one: '{{count}} article', item_many: '{{count}} d\'articles', item_other: '{{count}} articles', hello: 'Bonjour {{name}}',
  });
  write(path.join(d, 'locales/de.json'), de || { item_one: '{{count}} Artikel', item_other: '{{count}} Artikel', hello: 'Hallo {{name}}' });
  write(path.join(d, 'champollion.config.json'), { version: 3, inputLocale: 'en', localesDir: './locales', languages: ['fr', 'de'] });
  return d;
}

const DJANGO_EN = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: en\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

#, python-format
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] ""
msgstr[1] ""

#, python-format
msgid "Hi %(name)s"
msgstr ""
`;
const DJANGO_FR = (hi) => `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: fr\\n"
"Plural-Forms: nplurals=2; plural=(n > 1);\\n"

#, python-format
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "Un fichier"
msgstr[1] "%(count)d fichiers"

#, python-format
msgid "Hi %(name)s"
msgstr "${hi}"
`;
function djangoProject(hi) {
  const d = tmp('django');
  write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), DJANGO_EN);
  write(path.join(d, 'locale/fr/LC_MESSAGES/django.po'), DJANGO_FR(hi));
  write(path.join(d, 'champollion.config.json'), { version: 3, inputLocale: 'en', localesDir: './locale', format: 'po', languages: ['fr'] });
  return d;
}

// ── 5. plural coverage ────────────────────────────────────────────────────

describe('Round 12 #5 — verify names the plural forms each locale is expected to have', () => {
  it('a locale with i18next plural keys gets one line naming its CLDR forms, ✓ when every key is there', () => {
    const d = i18nextProject();
    const r = cli(['verify'], d);
    assert.equal(r.code, 0, r.out);
    const fr = cldr('fr').join(', ');
    const de = cldr('de').join(', ');
    assert.ok(cldr('fr').includes('many'), 'CLDR gives French a many form (the persona\'s case)');
    assert.ok(r.stdout.includes(`  Plural forms (CLDR fr): ${fr} ✓ — 1 i18next plural key group(s), every form present`), r.out);
    assert.ok(r.stdout.includes(`  Plural forms (CLDR de): ${de} ✓ — 1 i18next plural key group(s), every form present`), r.out);
    // Inside the locale's own block, after its key-count line.
    const from = r.stdout.indexOf('── fr ──');
    const block = r.stdout.slice(from, from + r.stdout.slice(from).indexOf('\n\n'));
    assert.match(block, /── fr ──+\n {2}\[OK\] 4\/4 keys present\n {2}Plural forms \(CLDR fr\)/, r.stdout);
  });

  it('a group without one of the locale\'s forms is ✗ and names the key (the finding itself is the missing-key error)', () => {
    const d = i18nextProject({ fr: { item_one: '{{count}} article', item_other: '{{count}} articles', hello: 'Bonjour {{name}}' } });
    const r = cli(['verify'], d);
    assert.equal(r.code, 1, r.out);
    assert.ok(r.stdout.includes(`  Plural forms (CLDR fr): ${cldr('fr').join(', ')} ✗ — 1 of 1 i18next plural key group(s) lack a form: item_many`), r.out);
    assert.match(r.stderr, /\[VERIFY\] fr: 1 missing key\(s\): item_many/);
  });

  it('a project with no plurals gets no plural line', () => {
    const d = tmp('flat');
    write(path.join(d, 'locales/en.json'), { greeting: 'Hello', bye: 'Goodbye' });
    write(path.join(d, 'locales/fr.json'), { greeting: 'Bonjour', bye: 'Au revoir' });
    const r = cli(['verify'], d);
    assert.equal(r.code, 0, r.out);
    assert.match(r.stdout, /\[OK\] 2\/2 keys present/);
    assert.doesNotMatch(r.out, /Plural forms|Ordinal forms/);
  });

  it('ICU plural messages: CLDR\'s forms for the locale; a form only large numbers use is said apart, an everyday one missing is ✗', () => {
    const d = tmp('icu');
    const src = '{n, plural, one {# message} other {# messages}}';
    write(path.join(d, 'messages/en.json'), { inbox: src });
    write(path.join(d, 'messages/fr.json'), { inbox: '{n, plural, one {# message} other {# messages reçus}}' });
    write(path.join(d, 'messages/ru.json'), { inbox: '{n, plural, one {# сообщение} other {# сообщения}}' });
    write(path.join(d, 'champollion.config.json'), { version: 3, inputLocale: 'en', localesDir: './messages', languages: ['fr', 'ru'] });
    const r = cli(['verify'], d);
    const frUse = pluralCategoryUse('fr');
    assert.ok(frUse.rare.includes('many'), 'French many is reached only above 1000 (CLDR)');
    assert.ok(r.stdout.includes(`  Plural forms (CLDR fr): ${cldr('fr').join(', ')} ✓ — 1 ICU plural message(s), every form ordinary counts use present; `
      + 'many is used only above 1000 or for fractions — "other" stands in for it in 1'), r.out);
    const ruMissing = pluralCategoryUse('ru').everyday.filter(c => c !== 'one');
    assert.ok(r.stdout.includes(`  Plural forms (CLDR ru): ${cldr('ru').join(', ')} ✗ — 1 of 1 ICU plural message(s) lack a form: inbox (${ruMissing.join(', ')})`), r.out);
  });

  it('a gettext catalog: the forms its Plural-Forms holds', () => {
    const d = djangoProject('Salut %(name)s');
    const r = cli(['verify'], d);
    assert.equal(r.code, 0, r.out);
    // nplurals=2 for French: CLDR's many has no slot in this catalog.
    assert.ok(r.stdout.includes('  Plural forms (CLDR fr, the forms the catalog\'s Plural-Forms has): one, other ✓ — 1 gettext plural entr(y/ies), every form present'), r.out);
  });

  it('--json: one `verify` record per locale with keys, findings and plural coverage; the closing line keeps its level and message', () => {
    const d = i18nextProject();
    const r = cli(['verify', '--json'], d);
    assert.equal(r.code, 0, r.stderr);
    const lines = r.stdout.trim().split('\n').map(l => JSON.parse(l));
    for (const l of r.stderr.trim().split('\n').filter(Boolean)) JSON.parse(l); // stderr stays NDJSON too
    const events = lines.filter(l => l.level === 'event' && l.event === 'verify');
    assert.deepEqual(events.map(e => e.locale).sort(), ['de', 'fr']);
    const fr = events.find(e => e.locale === 'fr');
    assert.equal(fr.ok, true);
    assert.equal(fr.pair, 'en:fr');
    assert.deepEqual(fr.keys, { expected: 4, present: 4, missing: 0, extra: [] });
    assert.deepEqual(fr.errors, []);
    assert.deepEqual(fr.placeholders, []);
    assert.deepEqual(fr.plurals, [{
      kind: 'i18next-keys', type: 'cardinal', basis: 'cldr', categories: cldr('fr'),
      total: 1, complete: 1, ok: true, incomplete: [],
    }]);
    // The closing line: last on stdout, same level and message as before.
    const last = lines.at(-1);
    assert.equal(last.level, 'ok');
    assert.match(last.message, /^Verification passed: keys, placeholders, plurals, markup and script are intact in every locale — the meaning is not checked; have a speaker review before relying on it\.$/);
    assert.equal(last.errors, 0);
    assert.equal(last.warnings, 0);
    assert.ok(lines.indexOf(last) > lines.indexOf(fr), 'per-locale records come before the closing line');
  });

  it('--json on a failing run: the record says what is incomplete; the closing error line carries the counts', () => {
    const d = i18nextProject({ fr: { item_one: '{{count}} article', item_other: '{{count}} articles', hello: 'Bonjour {{name}}' } });
    const r = cli(['verify', '--json'], d);
    assert.equal(r.code, 1);
    const fr = r.stdout.trim().split('\n').map(l => JSON.parse(l)).find(l => l.event === 'verify' && l.locale === 'fr');
    assert.equal(fr.ok, false);
    assert.equal(fr.keys.missing, 1);
    assert.deepEqual(fr.plurals[0].incomplete, [{ key: 'item', missing: ['many'], keys: ['item_many'] }]);
    assert.match(fr.errors[0], /1 missing key\(s\): item_many/);
    const closing = r.stderr.trim().split('\n').map(l => JSON.parse(l)).find(l => /^Verification: /.test(l.message));
    assert.equal(closing.level, 'error');
    assert.equal(closing.message, 'Verification: 1 error(s), 0 warning(s).');
    assert.equal(closing.errors, 1);
  });
});

// ── 6. help ───────────────────────────────────────────────────────────────

describe('Round 12 #6 — verify --help: a whole heading, and a Checks list that says what verify checks', () => {
  it('the heading is a complete sentence', () => {
    const r = spawnSync(process.execPath, [CLI, 'verify', '--help'], { encoding: 'utf-8' });
    const heading = r.stdout.split('\n').find(l => l.startsWith('  champollion verify — '));
    assert.ok(heading, r.stdout);
    assert.match(heading, /^ {2}champollion verify — [A-Z][^]*\.$/, 'ends a sentence, not mid-clause');
    assert.equal(heading.slice('  champollion verify — '.length), COMMAND_HELP.verify.description[0]);
  });

  it('the Checks list names i18next plural keys, the placeholder syntaxes, and puts each finding under the exit code it has', () => {
    const lines = COMMAND_HELP.verify.description;
    const text = lines.join('\n');
    const errorsAt = lines.indexOf('Errors (exit 1):');
    const warningsAt = lines.indexOf('Warnings (exit 0 unless --strict):');
    assert.ok(errorsAt > 0 && warningsAt > errorsAt, text);
    const errors = lines.slice(errorsAt, warningsAt).join(' ');
    const warnings = lines.slice(warningsAt, lines.indexOf('', warningsAt)).join(' ');
    // i18next plural keys: the locale's CLDR forms, French many among them.
    assert.match(errors, /count_one,\s+count_many, count_other/);
    assert.match(errors, /printf\/python-format/);
    assert.match(errors, /i18next \{\{name\}\}/);
    assert.match(errors, /ICU MessageFormat structure/);
    // Error in the code (sharedOutputErrors), listed as one; it used to be under warnings.
    assert.match(errors, /one text written for several different source strings/);
    assert.doesNotMatch(warnings, /several different source strings/);
    assert.match(warnings, /an i18next key for a form the locale does not have/);
    assert.match(warnings, /out of date/);
    assert.ok(COMMAND_HELP.verify.options.some(([flag]) => flag === '--json'));
  });

  it('what the Checks list calls an error is one, and what it calls a warning is one', () => {
    const src = { a: 'Hi %(name)s', b: 'Hello {{name}}', c: '{n, plural, one {# day} other {# days}}' };
    // printf, i18next and ICU placeholder damage: errors.
    const damaged = auditTranslations(src, { a: 'Salut', b: 'Bonjour', c: '{n, plurál, one {# jour} other {# jours}}' }, 'fr', {});
    assert.equal(damaged.errors.length, 3, damaged.errors.join('\n'));
    assert.equal(damaged.warnings.length, 0, damaged.warnings.join('\n'));
    // A Russian plural without its everyday forms: a warning.
    const gap = auditTranslations({ c: src.c }, { c: '{n, plural, one {# день} other {# дня}}' }, 'ru', {});
    assert.equal(gap.errors.length, 0, gap.errors.join('\n'));
    assert.match(gap.warnings.join('\n'), /plural message\(s\) without a form ru uses for ordinary counts/);
  });
});

// ── 9. findings named by the syntax involved ──────────────────────────────

describe('Round 12 #9 — a placeholder finding is named by its syntax, not "ICU" for everything', () => {
  it('Django: a lost %(name)s is a printf/python-format mismatch, not an ICU structure error', () => {
    const d = djangoProject('Salut');
    const r = cli(['verify'], d);
    assert.equal(r.code, 1, r.out);
    assert.match(r.stderr, /\[VERIFY\] fr: LC_MESSAGES\/django: 1 printf\/python-format placeholder mismatch\(es\): Hi %\(name\)s \(printf placeholder %\(name\)s is missing\) — fix: /);
    assert.doesNotMatch(r.out, /ICU/);
    const json = cli(['verify', '--json'], d);
    const fr = json.stdout.trim().split('\n').map(l => JSON.parse(l)).find(l => l.event === 'verify');
    assert.deepEqual(fr.placeholders, [{ key: 'LC_MESSAGES/django::Hi %(name)s', syntax: 'printf', issues: ['printf placeholder %(name)s is missing'] }]);
  });

  it('a gettext plural that lost its %d is one printf finding — no "{…}" noise from a one-word branch', () => {
    const src = '{n, plural, one {%d file} other {%d files}}';
    const { errors } = auditTranslations({ k: src }, { k: '{n, plural, one {un fichier} other {fichiers}}' }, 'fr', {});
    assert.equal(errors.length, 1, errors.join('\n'));
    assert.match(errors[0], /^1 printf\/python-format placeholder mismatch\(es\): k \(printf placeholder %d is missing\)/);
  });

  it('an ICU message\'s branches are not read as placeholders: a one-word branch ({Brak}) or one holding only {count} is no finding', () => {
    const src = '{count, plural, =0{No items} one{1 item} other{{count}}}';
    const pl = '{count, plural, =0{Brak} one{1 produkt} few{{count} produkty} many{{count} produktów} other{{count} produktu}}';
    const r = auditTranslations({ items: src }, { items: pl }, 'pl', {});
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.damaged, [], 'nothing to evict from the cache');
    // A real argument rename in the same shape is still caught, as ICU.
    const renamed = auditTranslations({ items: src }, { items: pl.replace(/\{count\} produktu/, '{liczba} produktu') }, 'pl', {});
    assert.match(renamed.errors.join('\n'), /^1 ICU structure error\(s\): items \(placeholder \{liczba\} is not in the source\)/);
  });

  it('ICU damage is still an ICU structure error — said once, not also as a placeholder mismatch', () => {
    const rename = auditTranslations({ k: 'Hello {name}' }, { k: 'Bonjour {nom}' }, 'fr', {});
    assert.deepEqual(rename.errors.map(e => e.replace(/ — fix: .*$/, '')), ['1 ICU structure error(s): k (placeholder {name} was changed to {nom})']);
    const keyword = auditTranslations({ k: '{count, plural, one {# item} other {# items}}' }, { k: '{count, plurál, one {# article} other {# articles}}' }, 'fr', {});
    assert.match(keyword.errors.join('\n'), /1 ICU structure error\(s\): k \(ICU keyword 'plural' was translated to 'plurál'\)/);
    assert.deepEqual(keyword.placeholders.map(p => p.syntax), ['icu']);
  });

  it('i18next: a lost or renamed {{name}} is an i18next {{…}} mismatch; {{name}} written as {name} is caught (i18next prints it as is)', () => {
    const lost = auditTranslations({ k: 'Hello {{name}}' }, { k: 'Bonjour' }, 'fr', {});
    assert.match(lost.errors.join('\n'), /^1 i18next \{\{…\}\} placeholder mismatch\(es\): k \(placeholder \{\{name\}\} is missing\)/);
    const single = auditTranslations({ k: 'Hello {{name}}' }, { k: 'Bonjour {name}' }, 'fr', {});
    assert.match(single.errors.join('\n'), /^1 i18next \{\{…\}\} placeholder mismatch\(es\): k \(placeholder \{\{name\}\} was changed to \{name\}\)/);
    assert.deepEqual(single.placeholders, [{ key: 'k', syntax: 'i18next', issues: ['placeholder {{name}} was changed to {name}'] }]);
    // Kept intact, nothing is reported; Hugo's Go templates are not i18next.
    assert.deepEqual(auditTranslations({ k: 'Hello {{ name }}' }, { k: 'Bonjour {{name}}' }, 'fr', {}).errors, []);
    assert.deepEqual(extractPlaceholders('{{ .Count }} items'), []);
  });

  it('the CLI says it the same way, and the integrity data gains a syntax per ICU-check finding (added, nothing renamed)', () => {
    const d = i18nextProject({ fr: { item_one: '{{count}} article', item_many: '{{count}} d\'articles', item_other: '{{count}} articles', hello: 'Bonjour {{nom}}' } });
    const r = cli(['verify'], d);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /\[VERIFY\] fr: 1 i18next \{\{…\}\} placeholder mismatch\(es\): hello \(placeholder \{\{name\}\} was changed to \{\{nom\}\}\) — fix: `champollion sync --pair en:fr --redo keys:hello`/);
    const [printf] = findICUStructureIssues({ k: 'Hi %(name)s' }, { k: 'Salut' }, 'fr');
    assert.deepEqual(printf.issues, ['printf placeholder %(name)s is missing']);
    assert.deepEqual(printf.syntaxes, ['printf']);
    const [icu] = findICUStructureIssues({ k: 'Hi {name}' }, { k: 'Salut' }, 'fr');
    assert.deepEqual(icu.syntaxes, ['icu']);
  });
});
