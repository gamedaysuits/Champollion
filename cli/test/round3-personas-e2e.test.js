/**
 * Round 3 synthetic users (Django gettext fr+ru, Next.js next-intl fr+de,
 * i18next folder-per-language, hospital ARB, school Next.js + newsletter),
 * end to end through the real CLI (bin/cli.js) against a tiny local
 * OpenAI-compatible model (test/fixtures/fake-openai-model.mjs). A unit-only
 * test let a crash ship last round; every finding here drives the binary.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), `r3-${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const writeConfig = (d, cfg) => write(path.join(d, 'champollion.config.json'), JSON.stringify(cfg));

// ── A Django project: `makemessages -l en` source, fr + ru targets ──────────
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

msgctxt "verb"
msgid "Open"
msgstr ""

msgid "Hello"
msgstr ""
`;

/** A model that writes Russian plurals with only one/other (unless told to supply all). */
function djangoModel({ fullRussian = () => false, latinRussianOpen = false } = {}) {
  return startFakeModel((key, src, { prompt }) => {
    const ru = /Russian/.test(prompt);
    if (src.startsWith('{n, plural')) {
      if (!ru) return '{n, plural, one {Un fichier} many {%(count)d de fichiers} other {%(count)d fichiers}}';
      return fullRussian()
        ? '{n, plural, one {Один файл} few {%(count)d файла} many {%(count)d файлов} other {%(count)d файла}}'
        : '{n, plural, one {Один файл} other {%(count)d файлов}}';
    }
    // An empty answer for the context key: a hard gate failure, twice.
    if (ru && latinRussianOpen && src === 'Open') return '';
    return ru ? `Привет ${src.length}` : `Bonjour ${src.length}`;
  });
}

async function djangoProject(model, langs = 'fr,ru') {
  const d = tmp('django');
  write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), DJANGO_EN);
  const env = { LOCAL_API_BASE: model.url };
  const init = await runCli(['init', '--yes', '--langs', langs, '--method', 'local', '--model', 'stub-1'], d, env);
  assert.equal(init.code, 0, init.out);
  return { d, env, init };
}

describe('Round 3 — Django persona (gettext .po, fr + ru)', () => {
  it('a plural the model left without Russian few/many is asked for again, flagged in sync, marked in the catalog, and reported by verify', async () => {
    const model = await djangoModel();
    try {
      const { d, env } = await djangoProject(model);
      const r = await runCli(['sync'], d, env);
      // A plural left without an everyday form is not a finished translation:
      // exit 2, and the summary line says why (Round 8, Django persona —
      // it exited 0, while the CI guide says unfinished keys mean 2).
      assert.equal(r.code, 2, r.out);
      assert.match(r.out, /1 plural message\(s\) lack a form the language uses for ordinary counts \(the "other" form stands in — listed above\)/);
      assert.doesNotMatch(r.out, /\[OK\] Synced/, 'never an [OK] summary over a marked gap');
      // Asked once more, naming the missing forms (never invented by the tool).
      const retry = model.calls.find(c => /RETRY: the previous translation had no "few", "many"/.test(c.prompt));
      assert.ok(retry, 'the gate asked the model again for the missing forms');
      // The sync warning names the key and the categories, and the repair.
      assert.match(r.stderr, /ru\/LC_MESSAGES\/django\.po: 1 plural message\(s\) have no "few" and "many" form/);
      assert.match(r.stderr, /"One file" \(few, many\)/);
      assert.match(r.stderr, /--redo 'keys:django::One file' --fresh/);
      // The catalog repeats `other` (msgfmt needs every msgstr) and SAYS so.
      const ru = read(path.join(d, 'locale/ru/LC_MESSAGES/django.po'));
      assert.match(ru, /# champollion: plural form\(s\) few \(msgstr\[1\]\), many \(msgstr\[2\]\) were not supplied/);
      assert.match(ru, /msgstr\[1\] "%\(count\)d файлов"\nmsgstr\[2\] "%\(count\)d файлов"/);
      // Post-sync verify and standalone verify both report it with the fix.
      assert.match(r.out, /\[VERIFY\] ru: django: 1 plural entr\(y\/ies\) repeat the "other" form where ru has its own: One file \(few, many\)/);
      assert.doesNotMatch(r.out, /Verification passed: keys/, 'not a clean pass');
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 0, 'a warning, not an error');
      assert.match(v.stderr, /repeat the "other" form .* --redo 'keys:django::One file' --fresh/);
      // French has no gap for ordinary counts; nothing flagged there.
      assert.doesNotMatch(v.stderr, /\[VERIFY\] fr:/);
    } finally {
      await model.close();
    }
  });

  it('asking again with a model that supplies every form clears the marker and the warning', async () => {
    let full = false;
    const model = await djangoModel({ fullRussian: () => full });
    try {
      const { d, env } = await djangoProject(model, 'ru');
      const first = await runCli(['sync', '--json'], d, env);
      assert.equal(first.code, 2, first.out);
      const summary = first.stdout.trim().split('\n').map(l => JSON.parse(l)).find(o => o.level === 'summary');
      assert.deepEqual(summary.locales[0].pluralGaps, { 'django::One file': ['few', 'many'] }, 'agents read the gaps from --json');
      assert.equal(summary.totalPluralGaps, 1);
      full = true;
      const r = await runCli(['sync', '--pair', 'en:ru', '--redo', 'keys:django::One file', '--fresh'], d, env);
      assert.equal(r.code, 0, r.out);
      const ru = read(path.join(d, 'locale/ru/LC_MESSAGES/django.po'));
      assert.doesNotMatch(ru, /# champollion:/);
      assert.match(ru, /msgstr\[1\] "%\(count\)d файла"\nmsgstr\[2\] "%\(count\)d файлов"/);
      const v = await runCli(['verify'], d, env);
      assert.doesNotMatch(v.out, /repeat the "other" form/);
    } finally {
      await model.close();
    }
  });

  it('a gettext context key prints as ␄ (never a raw U+0004) and round-trips into --redo keys:', async () => {
    const model = await djangoModel({ latinRussianOpen: true });
    try {
      const { d, env } = await djangoProject(model, 'ru');
      const r = await runCli(['sync'], d, env);
      assert.ok(!r.out.includes('\u0004'), 'no invisible control character anywhere in the output');
      assert.match(r.out, /verb␄Open/, 'the failed key is shown copyably');
      const v = await runCli(['verify'], d, env);
      assert.ok(!v.out.includes('\u0004'));
      const a = await runCli(['audit'], d, env);
      assert.ok(!a.out.includes('\u0004'));
      assert.match(a.out, /verb␄Open/);
      // Pasting what was printed re-queues exactly that key.
      const before = model.calls.length;
      const redo = await runCli(['sync', '--pair', 'en:ru', '--redo', 'keys:django::verb␄Open', '--fresh'], d, env);
      assert.ok(!redo.out.includes('\u0004'));
      const asked = model.calls.slice(before).flatMap(c => c.prompt.match(/"(?:msg_\d+|[^"]*)": "Open"/g) || []);
      assert.ok(asked.length > 0, `the redo asked for "Open" again:\n${redo.out}`);
    } finally {
      await model.close();
    }
  });

  it('init prints the real project-relative paths of the files it creates', async () => {
    const model = await djangoModel();
    try {
      const { init } = await djangoProject(model);
      assert.match(init.out, /Created 2 empty target file\(s\): locale\/fr\/LC_MESSAGES\/django\.po, locale\/ru\/LC_MESSAGES\/django\.po/);
    } finally {
      await model.close();
    }
  });

  it('after a --fresh redo the cache line says what was replaced, and the summary says what went to the model', async () => {
    const model = await djangoModel();
    try {
      const { d, env } = await djangoProject(model, 'fr');
      let r = await runCli(['sync'], d, env);
      assert.match(r.out, /Synced 3 keys total — 3 key\(s\) sent to the model, 0 served from the cache \(free\)\./);
      assert.match(r.out, /\[TM\] Saved 3 entries — 3 added this sync/);
      r = await runCli(['sync', '--redo', 'all', '--fresh'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.doesNotMatch(r.out, /\+0 this sync/);
      assert.match(r.out, /\[TM\] Saved 3 entries — 0 added, 3 re-translated to the same text this sync/);
      r = await runCli(['sync', '--redo', 'all'], d, env);
      assert.match(r.out, /0 key\(s\) sent to the model, 3 served from the cache \(free\)/);
    } finally {
      await model.close();
    }
  });
});

describe('Round 3 — dry runs catch a missing key', () => {
  it('sync --dry with a hosted method and no key warns that the real run would stop, names the variable, exits 0', async () => {
    const d = tmp('dry');
    write(path.join(d, 'messages/en.json'), JSON.stringify({ a: 'Hello there friend', b: 'Goodbye now' }));
    writeConfig(d, { inputLocale: 'en', localesDir: 'messages', languages: ['fr'] });
    const r = await runCli(['sync', '--dry'], d);
    assert.equal(r.code, 0, 'a preview never fails');
    assert.match(r.stderr, /Dry run only — the real sync would STOP here/);
    assert.match(r.stderr, /OPENROUTER_API_KEY/);
    assert.match(r.stderr, /A real run would stop before translating/);
    const j = await runCli(['sync', '--dry', '--json'], d);
    const summary = j.stdout.trim().split('\n').map(l => JSON.parse(l)).find(o => o.level === 'summary');
    assert.equal(summary.preflight.ready, false);
    assert.match(summary.preflight.failures[0].reason, /OPENROUTER_API_KEY/);
  });
});

// ── A Next.js project: next-intl messages/, fr + de ─────────────────────────
function nextModel() {
  // Ignores the target language — fr and de come back byte-identical.
  return startFakeModel((key, src, { model }) => `[${model}] ${src.replace(/Hello/g, 'Salut')}`);
}

async function nextProject(model, model1 = 'stub-1') {
  const d = tmp('next');
  const src = {};
  for (let i = 0; i < 10; i++) src[`k${i}`] = `Hello number ${i} today`;
  write(path.join(d, 'messages/en.json'), JSON.stringify(src));
  const cfg = (m) => writeConfig(d, { inputLocale: 'en', localesDir: 'messages', languages: ['fr', 'de'], defaultMethod: 'local', model: m });
  cfg(model1);
  return { d, src, cfg, env: { LOCAL_API_BASE: model.url } };
}

describe('Round 3 — Next.js persona (next-intl JSON, fr + de)', () => {
  it('the model-switch notice counts only translations of current source strings', async () => {
    const model = await nextModel();
    try {
      const { d, src, cfg, env } = await nextProject(model);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      // Edit two strings: their old translations stay in the cache.
      src.k1 = 'Hello edited one'; src.k2 = 'Hello edited two';
      write(path.join(d, 'messages/en.json'), JSON.stringify(src));
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      cfg('stub-2');
      // Nothing queued, nothing read from the old cache: nothing to say
      // (Round 5 — `status` carries the standing fact).
      assert.doesNotMatch((await runCli(['sync', '--dry'], d, env)).out, /Model changed/);
      // Every key queued again (the files gone): served from stub-1's cache.
      fs.rmSync(path.join(d, 'messages/fr.json'));
      fs.rmSync(path.join(d, 'messages/de.json'));
      const r = await runCli(['sync', '--dry'], d, env);
      // 12 entries per locale are cached under stub-1, but only 10 strings exist.
      assert.match(r.out, /fr: now stub-2; reusing translations from stub-1 \(10\)/);
      assert.doesNotMatch(r.out, /stub-1 \(12\)/);
    } finally {
      await model.close();
    }
  });

  it('identical fr and de files: verify names both locales (warning, exit 0)', async () => {
    const model = await nextModel();
    try {
      const { d, env } = await nextProject(model);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 0);
      assert.match(v.stderr, /de and fr: 10 of 10 translated values are identical/);
      assert.match(v.stderr, /--redo all --fresh/);
    } finally {
      await model.close();
    }
  });

  it('the "model you choose" licence line is said on the first sync only; status repeats it', async () => {
    const model = await nextModel();
    try {
      const { d, env } = await nextProject(model);
      const first = await runCli(['sync'], d, env);
      assert.match(first.out, /runs a model you choose/);
      const second = await runCli(['sync'], d, env);
      assert.doesNotMatch(second.out, /runs a model you choose/);
      const status = await runCli(['status'], d, env);
      assert.match(status.out, /licence: runs a model you choose/);
    } finally {
      await model.close();
    }
  });

  it('status says when the files mix two models after a switch, with the command that unifies them', async () => {
    const model = await nextModel();
    try {
      const { d, src, cfg, env } = await nextProject(model);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      cfg('stub-2');
      src.k3 = 'Hello edited three';
      write(path.join(d, 'messages/en.json'), JSON.stringify(src));
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const status = await runCli(['status'], d, env);
      assert.match(status.out, /mixed: the files hold text from 2 models — stub-1 \(9 keys\), stub-2 \(1 key, current\)/);
      assert.match(status.out, /champollion sync --pair en:fr --redo all --fresh-on-model-change/);
      const j = JSON.parse((await runCli(['status', '--json'], d, env)).stdout);
      assert.deepEqual(j.pairs.find(p => p.target === 'fr').modelsInFiles.map(m => m.model), ['stub-1', 'stub-2']);
      // After unifying, status no longer reports a mix.
      assert.equal((await runCli(['sync', '--redo', 'all', '--fresh-on-model-change'], d, env)).code, 0);
      assert.doesNotMatch((await runCli(['status'], d, env)).out, /mixed:/);
    } finally {
      await model.close();
    }
  });

  it('tm stats describes method, model and register in words', async () => {
    const model = await nextModel();
    try {
      const { d, env } = await nextProject(model);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const r = await runCli(['tm', 'stats'], d, env);
      assert.doesNotMatch(r.out, /local\|stub-1\|/);
      assert.match(r.out, /fr\s+10 entries\n\s+10 {2}local · model stub-1 · register formal-vous/);
    } finally {
      await model.close();
    }
  });

  it('--json cost: a model on this machine is a known $0 (local: true); one elsewhere is null, never 0', async () => {
    const model = await nextModel();
    try {
      const { d } = await nextProject(model);
      const summaryOf = (out) => out.trim().split('\n').map(l => JSON.parse(l)).find(o => o.level === 'summary');
      let s = summaryOf((await runCli(['sync', '--dry', '--json'], d, { LOCAL_API_BASE: model.url })).stdout);
      assert.equal(s.costEstimate.totalEstimatedCost, 0);
      assert.equal(s.costEstimate.pairs[0].local, true);
      const human = await runCli(['sync', '--dry'], d, { LOCAL_API_BASE: model.url });
      assert.match(human.out, /\$0 API cost \(runs on this machine/);
      s = summaryOf((await runCli(['sync', '--dry', '--json'], d, { LOCAL_API_BASE: 'http://10.255.0.1:9/v1' })).stdout);
      assert.equal(s.costEstimate.totalEstimatedCost, null, 'unknown is null, not 0');
      assert.equal(s.costEstimate.hasUnknownCosts, true);
      assert.match(s.costEstimate.unknownCost.reason, /en:fr \(local, local-unknown\)/);
    } finally {
      await model.close();
    }
  });

  it('progress lines of parallel locales never run together mid-line', async () => {
    // A model slow enough that both locales are in flight at once.
    const model = await startFakeModel((k, src) => `Salut ${src}`);
    try {
      const { d, env } = await nextProject(model);
      const r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, r.out);
      for (const line of r.stdout.split('\n')) {
        assert.doesNotMatch(line, /\S\[(INFO|OK|WARN|ERR)\]/, `a message was appended mid-line: ${JSON.stringify(line)}`);
        assert.doesNotMatch(line, /\.\.\.\s*\S/, `a progress line was continued: ${JSON.stringify(line)}`);
      }
      assert.match(r.stdout, /^ {5}de\.json \[OK\]$/m);
      assert.match(r.stdout, /^ {5}fr\.json \[OK\]$/m);
    } finally {
      await model.close();
    }
  });
});

// ── An i18next project: public/locales/<lng>/{common,recipes}.json ──────────
describe('Round 3 — i18next persona (folder per language)', () => {
  it('verify that finds no source fails with one line naming the path and the setting', async () => {
    const d = tmp('i18n');
    write(path.join(d, 'public/locales/en/common.json'), JSON.stringify({ a: 'Hello' }));
    writeConfig(d, { inputLocale: 'en', localesDir: 'public/locale', languages: ['fr'] });
    let v = await runCli(['verify'], d);
    assert.equal(v.code, 1, v.out);
    assert.match(v.stderr, /\[VERIFY\] Nothing verified: the locales folder public\/locale does not exist \("localesDir"/);
    writeConfig(d, { inputLocale: 'de', localesDir: 'public/locales', languages: ['fr'] });
    v = await runCli(['verify'], d);
    assert.equal(v.code, 1, v.out);
    assert.match(v.stderr, /Nothing verified: the source locale was not found — looked for public\/locales\/de\.json \("localesDir" and "inputLocale": "de"/);
  });

  it('a plural suffix French does not use (count_two) is flagged with French\'s real categories', async () => {
    const d = tmp('i18n');
    write(path.join(d, 'public/locales/en/common.json'), JSON.stringify({ items_one: '{{count}} item', items_other: '{{count}} items' }));
    write(path.join(d, 'public/locales/fr/common.json'), JSON.stringify({
      items_one: '{{count}} article', items_many: '{{count}} d\'articles', items_other: '{{count}} articles', items_two: '{{count}} deux',
    }));
    writeConfig(d, { inputLocale: 'en', localesDir: 'public/locales', languages: ['fr'] });
    const v = await runCli(['verify'], d);
    assert.match(v.stderr, /1 plural key\(s\) for a form fr does not have: items_two \(fr plural forms: one, many, other\)/);
  });

  it('gettext msgstr[n] beyond nplurals is reported as such', async () => {
    const d = tmp('po');
    write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), DJANGO_EN);
    write(path.join(d, 'locale/fr/LC_MESSAGES/django.po'), `msgid ""
msgstr ""
"Language: fr\\n"
"Plural-Forms: nplurals=2; plural=(n > 1);\\n"

#, python-format
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "Un fichier"
msgstr[1] "%(count)d fichiers"
msgstr[2] "%(count)d fichiers"
`);
    writeConfig(d, { inputLocale: 'en', localesPattern: 'locale/{lang}/LC_MESSAGES/{ns}.po', languages: ['fr'] });
    const v = await runCli(['verify'], d);
    assert.match(v.stderr, /more forms than the catalog's nplurals=2 \(fr: one, other\): One file \(msgstr\[0\.\.2\]\)/);
  });

  it('French _many, which English has no key for, is said to be translated from _other — and the model is asked for that form', async () => {
    const model = await startFakeModel((k, src) => `FR ${src}`);
    try {
      const d = tmp('i18n');
      write(path.join(d, 'public/locales/en/common.json'), JSON.stringify({ items_one: '{{count}} item', items_other: '{{count}} items' }));
      writeConfig(d, { inputLocale: 'en', localesDir: 'public/locales', languages: ['fr'], defaultMethod: 'local', model: 'm' });
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /fr\/common\.json: items_many — "many" is a French plural form\(s\) the en source has no key for; each is translated from the "_other" text, and the model is asked to write that form \(many \(1000000\)\)/);
      assert.ok(model.calls.some(c => /"items_many": Plural form "many"/.test(c.prompt)), 'the prompt asked for the many form');
    } finally {
      await model.close();
    }
  });

  it('a coached pair with a dictionary still tells the model which plural form a key needs', async () => {
    const model = await startFakeModel((k, src) => `FR ${src}`);
    try {
      const d = tmp('coach');
      write(path.join(d, 'public/locales/en/common.json'), JSON.stringify({ items_one: '{{count}} item', items_other: '{{count}} items' }));
      write(path.join(d, '.champollion/coaching/fr.json'), JSON.stringify({ dictionary: { item: 'article' } }));
      writeConfig(d, { inputLocale: 'en', localesDir: 'public/locales', languages: ['fr'], defaultMethod: 'llm-coached', provider: 'local', model: 'm' });
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.equal(r.code, 0, r.out);
      assert.ok(model.calls.some(c => /"items_many": Plural form "many"/.test(c.prompt)),
        `the coached prompt carried the plural instruction:\n${model.calls.map(c => c.prompt).join('\n---\n')}`);
    } finally {
      await model.close();
    }
  });
});

// ── Hospital persona: Flutter ARB phrasebook ────────────────────────────────
describe('Round 3 — hospital persona (verify wording)', () => {
  it('a clean verify says it checked structure, not meaning', async () => {
    const d = tmp('arb');
    write(path.join(d, 'locales/en.json'), JSON.stringify({ where: 'Where does it hurt?', dose: 'One dose' }));
    write(path.join(d, 'locales/fr.json'), JSON.stringify({ where: 'Où avez-vous mal ?', dose: 'Une dose' }));
    writeConfig(d, { inputLocale: 'en', localesDir: 'locales', languages: ['fr'] });
    const v = await runCli(['verify'], d);
    assert.equal(v.code, 0, v.out);
    assert.match(v.stdout, /Structural checks passed \(meaning is not checked\)/);
    assert.match(v.stdout, /Verification passed: keys, placeholders, plurals, markup and script are intact in every locale — the meaning is not checked; have a speaker review before relying on it\./);
    assert.doesNotMatch(v.stdout, /All checks passed|look good/);
  });
});

// ── School persona: app/messages + a newsletter folder ──────────────────────
describe('Round 3 — school persona (init detection)', () => {
  it('init finds app/messages and suggests the newsletter folder without enabling it', async () => {
    const d = tmp('school');
    write(path.join(d, 'package.json'), JSON.stringify({ name: 'school', dependencies: { next: '15.0.0' } }));
    write(path.join(d, 'app/messages/en.json'), JSON.stringify({ title: 'Welcome' }));
    write(path.join(d, 'newsletter/2026-09.md'), '# September\n\nNews.');
    write(path.join(d, 'newsletter/2026-10.md'), '# October\n\nNews.');
    write(path.join(d, 'README.md'), '# School site');
    const r = await runCli(['init', '--yes', '--langs', 'fr'], d);
    assert.equal(r.code, 0, r.out);
    const cfg = JSON.parse(read(path.join(d, 'champollion.config.json')));
    assert.equal(cfg.localesDir, './app/messages');
    assert.equal(cfg.contentDir, undefined, 'content translation is suggested, never switched on');
    assert.match(r.out, /Markdown found in newsletter\/ \(2 file\(s\)\) — not translated unless you ask: add --content-dir newsletter/);
    assert.ok(fs.existsSync(path.join(d, 'app/messages/fr.json')));
  });

  it('a locale folder two levels down is found too', async () => {
    const d = tmp('nested');
    write(path.join(d, 'apps/web/locales/en.json'), JSON.stringify({ title: 'Welcome' }));
    const r = await runCli(['init', '--yes', '--langs', 'fr'], d);
    assert.equal(r.code, 0, r.out);
    assert.equal(JSON.parse(read(path.join(d, 'champollion.config.json'))).localesDir, './apps/web/locales');
  });

  it('init help and init\'s own hints show --method / --model, including a local model', async () => {
    const help = await runCli(['init', '--help'], tmp('help'));
    assert.match(help.out, /--method local --model llama3\.1/);
    const d = tmp('hint');
    write(path.join(d, 'locales/en.json'), JSON.stringify({ a: 'Hello' }));
    const r = await runCli(['init', '--yes', '--langs', 'fr'], d);
    // Round 10: the config fields, never `init --force` (it rewrote the whole file).
    assert.match(r.out, /Method: llm, model .*To use another, edit "defaultMethod" and "model" in champollion\.config\.json/);
    assert.match(r.out, /To try one for a single run: champollion sync --method <name> --model <model>/);
    assert.match(r.out, /"defaultMethod": "local" and "model": "llama3\.1"/);
    assert.doesNotMatch(r.out, /init --force/);
  });
});

// ── The CI guide's gettext workflow ─────────────────────────────────────────
describe('Round 3 — CI guide (gettext / Django)', () => {
  const guide = read(new URL('../website/docs/guides/ci-cd.md', import.meta.url));
  const django = guide.slice(guide.indexOf('### gettext (Django, Babel) and Flutter'), guide.indexOf('Flutter needs no extra step'));

  it('stages only the catalogs and the lock file (never the .mo files compilemessages writes)', () => {
    assert.doesNotMatch(django, /git add --all/);
    assert.match(django, /git add -- '\*\.po' \.champollion\.lock/);
  });
  it('extracts with --no-wrap, names a hosted method, runs one sync at a time, on a current Node LTS', () => {
    assert.match(django, /makemessages --all --no-wrap/);
    // Round 13: in the job's SYNC_FLAGS, which the sync line reads.
    assert.match(django, /SYNC_FLAGS: --method llm --model \S+ --max-cost/);
    assert.match(django, /champollion@0\.5 sync \$SYNC_FLAGS/);
    assert.match(django, /concurrency:\n\s+group: i18n-sync-/);
    assert.doesNotMatch(guide, /node-version: 20\b/);
    assert.match(django, /node-version: 24/);
  });
});
