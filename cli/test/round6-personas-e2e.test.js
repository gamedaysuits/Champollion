/**
 * Round 6 synthetic developers — the school (Next.js + a `newsletter/`
 * Markdown folder, a model that collapses short strings into one memorized
 * sentence), i18next (fr + es plurals, the CI guide), Django (gettext),
 * Next.js (model switches) and the hospital (Flutter ARB, everything
 * on-site) — end to end through the real CLI (bin/cli.js) against a tiny
 * local model (test/fixtures/fake-openai-model.mjs). No network, no key.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { compileFileScope } from '../lib/file-scope.js';
import { SharedOutputIndex } from '../lib/validate.js';
import { resolveConfig } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';
import { loadTM, saveTM, storeTM, evictTM, cacheKey, tmMethodKey } from '../lib/tm.js';
import { tmSourceText } from '../lib/tm-evict.js';

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), `r6-${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const readJSON = (file) => JSON.parse(read(file));
const writeJSON = (file, obj) => write(file, JSON.stringify(obj, null, 2));

// ── 12. The repair a memorized-sentence warning prints, end to end ───────────
describe('Round 6 — school: a memorized sentence in a newsletter is repaired by the command sync prints', () => {
  const MEM = 'Merci de votre visite à notre école aujourd hui';
  const NEWSLETTER = '---\ntitle: "October news"\n---\n\n# A busy month ahead\n\n'
    + 'The science fair is on Friday, and every class will present a project to the families.\n';

  function school() {
    const d = tmp('school');
    writeJSON(path.join(d, 'messages/en.json'), { welcome: 'Welcome to the Riverside School family website' });
    write(path.join(d, 'newsletter/2026-10.md'), NEWSLETTER);
    const cfg = { inputLocale: 'en', localesDir: 'messages', languages: ['fr'], defaultMethod: 'local', model: 'stub-1', contentDir: 'newsletter' };
    writeJSON(path.join(d, 'champollion.config.json'), cfg);
    return { d, cfg };
  }
  // The forge model: every short string becomes the one sentence it memorized.
  // The fallback (another local model) translates.
  const forge = (k, s, { model }) => (model === 'fb-1' ? `FB ${s}` : (s.length < 40 ? MEM : `FR ${s}`));

  it('title + H1 written as one sentence: warned with a repair command that works; without a fallback it says so plainly; with one, it repairs and verify is clean', async () => {
    const model = await startFakeModel(forge);
    try {
      const { d, cfg } = school();
      const env = { LOCAL_API_BASE: model.url };
      const first = await runCli(['sync'], d, env);
      const target = path.join(d, 'newsletter/2026-10.fr.md');
      assert.match(read(target), new RegExp(`title: "${MEM}"`), 'the title went out before the repeat showed');
      assert.match(first.out, /came back for 2 different source string\(s\) — a model repeating a memorized sentence\. .*already written .* for 2026-10\.md front matter:title\. Removed from the cache, and remembered/);
      const hint = /`(champollion sync --pair en:fr --redo files:[^`]+)`/.exec(first.out)?.[1];
      assert.equal(hint, 'champollion sync --pair en:fr --redo files:2026-10.md');
      // The cache no longer holds it: nothing is served from it again.
      const tm = readJSON(path.join(d, '.champollion/tm.json'));
      assert.ok(!Object.values(tm).some(e => e && e.t === MEM), 'the memorized sentence left the cache');
      assert.deepEqual(tm._meta.memorized.fr, [MEM]);
      // verify names the title as the remembered sentence (an error).
      const v0 = await runCli(['verify'], d, env);
      assert.equal(v0.code, 1, v0.out);
      assert.match(v0.out, /1 value\(s\) hold the sentence an earlier sync caught the model repeating .* for 2026-10\.md front matter:title/);

      // Every spelling of the file matches — the printed one, the path from
      // the project root, `**`, with and without --fresh.
      for (const args of [hint.split(' ').slice(1), ['sync', '--redo', 'files:newsletter/2026-10.md'],
        ['sync', '--redo', 'files:**', '--fresh'], ['sync', '--redo', 'files:2026-10.md', '--fresh'], ['sync', '--force-content']]) {
        const r = await runCli(args, d, env);
        assert.doesNotMatch(r.out, /No content file matches/, `${args.join(' ')}\n${r.out}`);
        // Without a fallback the model is asked again (twice: once, then with
        // the reason), answers with the same sentence, and the run says so
        // plainly — the title keeps its source text, never the sentence.
        assert.equal(r.code, 2, r.out);
        assert.match(r.out, /front matter "title" kept in the source language — the sentence the model gave for other, different source strings on an earlier sync \("Merci de votre visite/);
        assert.match(r.out, /local answers it only with a sentence it gave for other strings — add a "fallback" method to the pair/);
        assert.match(read(target), /title: "?October news"?/);
      }

      // With a fallback, the printed command repairs it; verify is clean.
      writeJSON(path.join(d, 'champollion.config.json'), {
        ...cfg, pairs: { 'en:fr': { method: 'local', model: 'stub-1', fallback: { method: 'local', model: 'fb-1' } } },
      });
      const fixed = await runCli(hint.split(' ').slice(1), d, env);
      assert.equal(fixed.code, 0, fixed.out);
      assert.match(fixed.out, /\[FALLBACK\] en:fr — 2 content segment\(s\) the primary \(local\) could not translate safely → translated by local \(2 accepted/);
      const page = read(target);
      assert.match(page, /title: "FB October news"/);
      assert.match(page, /FB # A busy month ahead/);
      assert.doesNotMatch(page, new RegExp(MEM));
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 0, v.out);
    } finally {
      await model.close();
    }
  });

  it('--redo files: patterns match the contentDir path and the project-root path; a typo still fails loud', () => {
    const fresh = compileFileScope({ retranslate: ['newsletter/2026-10.md'] }, { rootPrefix: 'newsletter' });
    assert.ok(fresh.includes('2026-10.md') && fresh.retranslates('2026-10.md'));
    fresh.assertAllMatched();
    const star = compileFileScope({ retranslate: ['**'] }, { rootPrefix: './newsletter/' });
    star.includes('2026-10.md');
    star.assertAllMatched();
    const typo = compileFileScope({ retranslate: ['2026-11.md'] }, { rootPrefix: 'newsletter' });
    typo.includes('2026-10.md');
    assert.throws(() => typo.assertAllMatched(), /No content file matches "2026-11\.md"\. .*or the path from the project root \("newsletter\/…"\)/);
  });
});

// ── 13. Two clearly different sources, one long sentence ────────────────────
describe('Round 6 — school: the same long sentence for two clearly different strings is the pattern', () => {
  it('flagged at two sources for a 4+-word output; synonyms and short outputs still need three', () => {
    const items = (pairs) => pairs.map(([key, source, value]) => ({ key, source, value }));
    const memorized = 'Merci de votre visite à notre école aujourd hui';
    let index = new SharedOutputIndex();
    assert.equal(index.suspects(items([['thanks', 'Thank you for coming!', memorized], ['forms', 'Please bring the forms.', memorized]])).size, 2);
    // Synonym-like sources (sharing half their words) → wait for a third.
    index = new SharedOutputIndex();
    assert.equal(index.suspects(items([['a', 'Sign in to your account', 'Connectez-vous à votre compte'], ['b', 'Log in to your account', 'Connectez-vous à votre compte']])).size, 0);
    // Short outputs → wait for a third ('OK'/'Okay' → "D'accord").
    index = new SharedOutputIndex();
    assert.equal(index.suspects(items([['ok', 'OK', "D'accord"], ['okay', 'Okay', "D'accord"]])).size, 0);
    assert.equal(index.suspects(items([['ok', 'OK', "D'accord"], ['okay', 'Okay', "D'accord"], ['sure', 'Sure', "D'accord"]])).size, 0);
    // One-word sources need a third too.
    index = new SharedOutputIndex();
    assert.equal(index.suspects(items([['c', 'Close', memorized], ['d', 'Dismiss', memorized]])).size, 0);
  });

  it('a sync refuses both and writes neither', async () => {
    const MEM = 'Merci de votre visite à notre école aujourd hui';
    const model = await startFakeModel(() => MEM);
    try {
      const d = tmp('two');
      writeJSON(path.join(d, 'messages/en.json'), { thanks: 'Thank you for coming!', forms: 'Please bring the forms.' });
      writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'messages', languages: ['fr'], defaultMethod: 'local', model: 'stub-1' });
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.equal(r.code, 1, r.out);
      assert.match(r.out, /same output for 2 different source strings \("Thank you for coming!", "Please bring the forms\."\)/);
      const fr = fs.existsSync(path.join(d, 'messages/fr.json')) ? readJSON(path.join(d, 'messages/fr.json')) : {};
      assert.ok(!Object.values(fr).includes(MEM), JSON.stringify(fr));
    } finally {
      await model.close();
    }
  });
});

// ── 10 + 11. The hospital: everything on site ───────────────────────────────
/** A champollion-API endpoint (lib/methods/api.js contract) answering with `answer(source)`. */
async function startApi(answer) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const { keys = {} } = JSON.parse(body || '{}');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ translations: Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, answer(v)])) }));
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}/translate`, close: () => new Promise(r => server.close(r)) };
}

describe('Round 6 — hospital: a local fallback, and a question that lost its "?"', () => {
  async function ward(keys, api, fallback = { method: 'local', model: 'ward-fallback' }) {
    const d = path.join(tmp('ward'), 'app');
    write(path.join(d, 'pubspec.yaml'), 'name: ward\nflutter:\n  generate: true\n');
    write(path.join(d, 'l10n.yaml'), 'arb-dir: lib/l10n\ntemplate-arb-file: app_en.arb\n');
    write(path.join(d, 'lib/l10n/app_en.arb'), JSON.stringify({ '@@locale': 'en', ...keys }, null, 2));
    const init = await runCli(['init', '--yes', '--langs', 'abc', '--method', 'api', '--endpoint', api.url, '--accepts-instructions', 'false'], d);
    assert.equal(init.code, 0, init.out);
    const cfg = readJSON(path.join(d, 'champollion.config.json'));
    if (fallback) cfg.pairs['en:abc'].fallback = fallback;
    writeJSON(path.join(d, 'champollion.config.json'), cfg);
    return d;
  }
  const arb = (d) => readJSON(path.join(d, 'lib/l10n/app_abc.arb'));

  it('a local fallback fills the key the primary\'s gate refused — nothing leaves the machine', async () => {
    // The forge model drops the {name} placeholder; everything else is fine.
    const api = await startApi((src) => (src.includes('{name}') ? 'Tânisi nitôtêm' : `ABC ${src}`));
    const local = await startFakeModel((k, src) => `LOCAL ${src}`);
    try {
      const d = await ward({ greeting: 'Hello, {name}! Welcome to the ward.', menu: 'Open the menu for the day' }, api);
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: local.url });
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /Pairs: abc:api \(fallback: local\)/);
      assert.match(r.out, /\[FALLBACK\] en:abc — 1 key\(s\) the primary \(api\) could not translate safely → translated by local \(1 accepted, 0 still failing\)/);
      const out = arb(d);
      assert.equal(out.greeting, 'LOCAL Hello, {name}! Welcome to the ward.');
      assert.equal(out.menu, 'ABC Open the menu for the day');
      // The local model was asked for the refused key only.
      assert.deepEqual(local.calls.flatMap(c => c.keys), ['greeting']);
      const v = await runCli(['verify'], d);
      assert.equal(v.code, 0, v.out);
    } finally {
      await api.close();
      await local.close();
    }
  });

  it('"Where does it hurt?" written without its "?": sync and verify warn (not a refusal), naming particles; --strict fails', async () => {
    const api = await startApi((src) => (src === 'Where does it hurt?' ? 'Tânitê kâ-wîsakêyihtaman' : `ABC ${src}`));
    try {
      const d = await ward({ whereHurt: 'Where does it hurt?', callFamily: 'We will call your family!', dose: 'One dose' }, api, null);
      const r = await runCli(['sync'], d);
      assert.equal(r.code, 0, `a warning, not a failure\n${r.out}`);
      assert.equal(arb(d).whereHurt, 'Tânitê kâ-wîsakêyihtaman', 'written: not a refusal');
      assert.match(r.out, /app_abc\.arb: 1 translation\(s\) dropped the source's closing "\?": whereHurt \("Tânitê kâ-wîsakêyihtaman"\) — a question or exclamation may now read as a statement\. Some languages mark a question with a word or particle instead of a mark, so this is a warning, not a refusal/);
      assert.match(r.out, /ask again \(--fresh: the cache holds this answer\): `champollion sync --pair en:abc --redo keys:whereHurt --fresh`/);
      const v = await runCli(['verify'], d);
      assert.equal(v.code, 0, v.out);
      assert.match(v.stderr, /\[VERIFY\] abc: 1 translation\(s\) dropped the source's closing "\?": whereHurt/);
      assert.doesNotMatch(v.out, /callFamily \(/, 'the "!" was kept');
      const strict = await runCli(['verify', '--strict'], d);
      assert.equal(strict.code, 1);
    } finally {
      await api.close();
    }
  });
});

// ── 1. i18next: a borrowed plural form has its own cache entry ──────────────
describe('Round 6 — i18next: French/Spanish _many (from the English _other text) is cached apart from _other', () => {
  const SRC = { recipes_one: '{{count}} recipe', recipes_other: '{{count}} recipes', title: 'My family cookbook' };
  // A model that writes a distinct many form, as a real one does.
  const chef = (k, src) => {
    if (k.endsWith('_many')) return '{{count}} de recettes';
    if (k.endsWith('_one')) return '{{count}} recette';
    if (k.endsWith('_other')) return '{{count}} recettes';
    return `FR ${src}`;
  };
  function project() {
    const d = tmp('i18n');
    writeJSON(path.join(d, 'public/locales/en/common.json'), SRC);
    writeJSON(path.join(d, 'champollion.config.json'), {
      inputLocale: 'en', localesDir: 'public/locales', languages: ['fr', 'es'], defaultMethod: 'local', model: 'stub-1',
    });
    return d;
  }
  const fr = (d) => readJSON(path.join(d, 'public/locales/fr/common.json'));

  it('distinct many/other answers are cached separately; --redo all keeps them distinct', async () => {
    const model = await startFakeModel(chef);
    try {
      const d = project();
      const env = { LOCAL_API_BASE: model.url };
      const first = await runCli(['sync'], d, env);
      assert.equal(first.code, 0, first.out);
      assert.match(first.out, /\[TM\] Saved 8 entries — 8 added this sync/, 'one entry per key: nothing replaced or shared');
      assert.doesNotMatch(first.out, /re-translated to the same text|replaced with a new translation/);
      const before = model.calls.length;
      const redo = await runCli(['sync', '--redo', 'all'], d, env);
      assert.equal(redo.code, 0, redo.out);
      assert.equal(model.calls.length, before, 'everything served from the cache');
      assert.deepEqual(fr(d), { recipes_one: '{{count}} recette', recipes_many: '{{count}} de recettes', recipes_other: '{{count}} recettes', title: 'FR My family cookbook' });
      assert.doesNotMatch(redo.out, /the model is asked to write that form/, 'a cache hit was not asked anything');
      const v = await runCli(['verify'], d, env);
      assert.doesNotMatch(v.out, /hold the same text as the form they are translated from/);
    } finally {
      await model.close();
    }
  });

  /** Rewrite the cache the way an earlier version left it: one shared entry per locale. */
  function legacyCache(d, sharedText) {
    const config = resolveConfig({}, d);
    const tm = loadTM(d);
    for (const pc of resolvePairs(config).values()) {
      const mk = tmMethodKey(pc);
      evictTM(tm, tmSourceText('recipes_many', SRC.recipes_other, 'many'), pc.target, mk);
      storeTM(tm, SRC.recipes_other, pc.target, mk, sharedText);
    }
    saveTM(d, tm);
  }

  it('an older cache whose shared entry holds the _many text: moved to _many\'s own entry; _other is translated once, never served "de recettes"', async () => {
    const model = await startFakeModel(chef);
    try {
      const d = project();
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      legacyCache(d, '{{count}} de recettes');
      const dry = await runCli(['sync', '--redo', 'all', '--dry'], d, env);
      assert.match(dry.out, /fr\/common\.json: 1 cached translation\(s\) of a plural form \(recipes_many\) were stored under the form they are translated from .* Moved to their own entry \(in this dry run only\)/);
      const before = model.calls.length;
      const redo = await runCli(['sync', '--redo', 'all'], d, env);
      assert.equal(redo.code, 0, redo.out);
      assert.deepEqual(model.calls.slice(before).flatMap(c => c.keys).sort(), ['recipes_other', 'recipes_other'], 'only _other, once per locale');
      assert.equal(fr(d).recipes_other, '{{count}} recettes');
      assert.equal(fr(d).recipes_many, '{{count}} de recettes');
      const tm = readJSON(path.join(d, '.champollion/tm.json'));
      const config = resolveConfig({}, d);
      const pc = [...resolvePairs(config).values()].find(p => p.target === 'fr');
      assert.equal(tm[cacheKey(SRC.recipes_other, 'fr', tmMethodKey(pc))].t, '{{count}} recettes');
      assert.equal(tm[cacheKey(tmSourceText('recipes_many', SRC.recipes_other, 'many'), 'fr', tmMethodKey(pc))].t, '{{count}} de recettes');
    } finally {
      await model.close();
    }
  });

  it('an older cache whose shared entry holds the _other text: _other is served from it; _many goes to the model once, and the run says why', async () => {
    const model = await startFakeModel(chef);
    try {
      const d = project();
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      legacyCache(d, '{{count}} recettes');
      // A value nothing records the model writing as that form (Round 7: the
      // lock decides, not the cache): an info line with the command.
      writeJSON(path.join(d, 'public/locales/fr/common.json'), { ...fr(d), recipes_many: '{{count}} recettes' });
      const v = await runCli(['verify', '--strict'], d, env);
      assert.equal(v.code, 0, 'an info line, not a warning');
      assert.match(v.stdout, /\[VERIFY\] fr: common: 1 plural form\(s\) hold the same text as the form they are translated from: recipes_many = recipes_other \("\{\{count\}\} recettes"\) — Champollion has no record of the model writing them as that form .*fr uses many \(1000000\)/);
      assert.match(v.stdout, /If they should differ: `champollion sync --pair en:fr --redo keys:common::recipes_many` \(sends 1 key\(s\) to the model\)/);
      const before = model.calls.length;
      const redo = await runCli(['sync', '--redo', 'all'], d, env);
      assert.equal(redo.code, 0, redo.out);
      assert.match(redo.out, /fr\/common\.json — 1 plural form\(s\) translated from another form's source text \(common::recipes_many\) are sent to the model once: until this release each shared a cache entry with the form it borrows from/);
      assert.deepEqual(model.calls.slice(before).flatMap(c => c.keys).sort(), ['recipes_many', 'recipes_many'], 'only _many, once per locale');
      assert.equal(fr(d).recipes_many, '{{count}} de recettes');
      assert.equal(fr(d).recipes_other, '{{count}} recettes');
      // Once: the next redo is free.
      const again = model.calls.length;
      assert.equal((await runCli(['sync', '--redo', 'all'], d, env)).code, 0);
      assert.equal(model.calls.length, again);
    } finally {
      await model.close();
    }
  });
});

// ── 2 + 3. The CI guide: plural findings per format; a guarded cache save ───
describe('Round 6 — CI guide: which plural findings fail verify, and no path warning on a no-change push', () => {
  const guide = read(new URL('../website/docs/guides/ci-cd.md', import.meta.url));
  const workflows = guide.split('```yaml').slice(1).map(b => b.slice(0, b.indexOf('```'))).filter(w => /actions\/cache\/save@v4/.test(w));

  it('every workflow saves the cache only when there is a .champollion folder', () => {
    assert.ok(workflows.length >= 2);
    for (const w of workflows) {
      // Round 11 adds a guard after this one (skip the save when the cache's
      // own hash is the key restored — round11-personas-e2e.test.js).
      assert.match(w, /- name: Save the translation cache\n\s+if: always\(\) && hashFiles\('\.champollion\/\*\*'\) != ''( && [^\n]+)?\n\s+uses: actions\/cache\/save@v4/);
    }
  });

  it('the guide states errors vs warnings per format — and verify does what it says', async () => {
    assert.match(guide, /\| i18next suffixed keys \(`count_one`, `count_other`, …\) \| A form the locale needs is missing \(French `count_many`\): it is a missing key\. \|/);
    assert.match(guide, /\| ICU messages .* \| The plural structure is damaged .* \| A branch the locale uses for everyday counts is missing \(Russian `few`, `many`\)/);
    assert.match(guide, /\| gettext \(`msgid_plural`\) \| An entry with no translation \(empty or `fuzzy`\): it is a missing key\. \|/);
    assert.doesNotMatch(guide, /a plural form the translation did not supply/);
    // i18next: a missing required form is an error (exit 1) without --strict.
    const d = tmp('ci');
    writeJSON(path.join(d, 'locales/en.json'), { item_one: '{{count}} item', item_other: '{{count}} items', ru: '{count, plural, one {# file} other {# files}}' });
    writeJSON(path.join(d, 'locales/fr.json'), { item_one: '{{count}} article', item_other: '{{count}} articles', ru: '{count, plural, one {# fichier} other {# fichiers}}' });
    writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'locales', languages: ['fr'] });
    const v = await runCli(['verify'], d);
    assert.equal(v.code, 1, v.out);
    assert.match(v.out, /1 missing key\(s\): item_many/);
    // ICU: a missing everyday branch is a warning (exit 0 once the key set is complete).
    writeJSON(path.join(d, 'locales/en.json'), { ru: '{count, plural, one {# file} other {# files}}' });
    writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'locales', languages: ['ru'] });
    writeJSON(path.join(d, 'locales/ru.json'), { ru: '{count, plural, one {# файл} other {# файлов}}' });
    const w = await runCli(['verify'], d);
    assert.equal(w.code, 0, w.out);
    assert.match(w.stderr, /plural message\(s\) without a form ru uses for ordinary counts/);
  });
});

// ── 4 + 5 + 6. Django: the preview, msginit's Plural-Forms, fuzzy entries ───
describe('Round 6 — Django: show-prompt for a translated key, gettext-conventional Plural-Forms, fuzzy said as fuzzy', () => {
  function django() {
    const d = tmp('django');
    write(path.join(d, 'manage.py'), '');
    write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), [
      'msgid ""', 'msgstr ""', '"Content-Type: text/plain; charset=UTF-8\\n"', '"Language: en\\n"', '',
      'msgid "Welcome back, %(name)s!"', 'msgstr ""', '',
      'msgid "One file"', 'msgid_plural "%(count)d files"', 'msgstr[0] ""', 'msgstr[1] ""', '',
    ].join('\n'));
    return d;
  }
  // A model that writes the forms gettext uses: one and other (Hebrew on its own model).
  const translate = (k, s, { model }) => (model === 'stub-he'
    ? (s.includes('plural') ? '{n, plural, one {קובץ אחד} other {%(count)d קבצים}}' : 'ברוך שובך, %(name)s!')
    : (s.includes('plural') ? '{n, plural, one {Un fichier} other {%(count)d fichiers}}' : 'Bon retour, %(name)s !'));
  const fr = (d) => read(path.join(d, 'locale/fr/LC_MESSAGES/django.po'));

  it('init writes msginit\'s French Plural-Forms; a one/other answer needs no comment; an existing header is kept', async () => {
    const model = await startFakeModel(translate);
    try {
      const d = django();
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['init', '--yes', '--langs', 'fr,he', '--method', 'local', '--model', 'stub-1'], d, env)).code, 0);
      const cfg = readJSON(path.join(d, 'champollion.config.json'));
      writeJSON(path.join(d, 'champollion.config.json'), { ...cfg, pairs: { ...(cfg.pairs || {}), 'en:he': { method: 'local', model: 'stub-he' } } });
      assert.match(fr(d), /"Plural-Forms: nplurals=2; plural=\(n > 1\);\\n"/);
      assert.match(read(path.join(d, 'locale/he/LC_MESSAGES/django.po')), /"Plural-Forms: nplurals=2; plural=\(n != 1\);\\n"/);
      const r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(fr(d), /msgstr\[0\] "Un fichier"\nmsgstr\[1\] "%\(count\)d fichiers"/);
      assert.doesNotMatch(fr(d), /# champollion:/);
      assert.doesNotMatch(r.out, /marked in the catalog|plural message\(s\) have/);
      // Hebrew's "two" has no slot in a two-form catalog: never asked again for.
      const heCalls = model.calls.filter(c => c.model === 'stub-he');
      assert.equal(heCalls.length, 1, 'one request for Hebrew: no retry for a form the catalog cannot hold');
      assert.equal((await runCli(['verify'], d, env)).code, 0);

      // A catalog that already has its own header keeps it (here CLDR's three forms).
      const d2 = django();
      write(path.join(d2, 'locale/fr/LC_MESSAGES/django.po'), ['msgid ""', 'msgstr ""', '"Content-Type: text/plain; charset=UTF-8\\n"', '"Language: fr\\n"',
        '"Plural-Forms: nplurals=3; plural=(n == 0 || n == 1) ? 0 : n != 0 && n % 1000000 == 0 ? 1 : 2;\\n"', ''].join('\n'));
      writeJSON(path.join(d2, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'locale', languages: ['fr'], defaultMethod: 'local', model: 'stub-1' });
      const r2 = await runCli(['sync'], d2, env);
      assert.equal(r2.code, 0, r2.out);
      assert.match(fr(d2), /nplurals=3; plural=\(n == 0 \|\| n == 1\) \? 0/);
      assert.match(fr(d2), /# champollion: plural form\(s\) many \(msgstr\[1\]\) were not supplied/, 'its many slot is marked');
    } finally {
      await model.close();
    }
  });

  it('--dry --show-prompt <a translated key>: the request is shown with why a real run sends nothing; an unknown key is said; nothing is sent', async () => {
    const model = await startFakeModel(translate);
    try {
      const d = django();
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['init', '--yes', '--langs', 'fr', '--method', 'local', '--model', 'stub-1'], d, env)).code, 0);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const before = model.calls.length;
      const r = await runCli(['sync', '--dry', '--show-prompt', 'Welcome back, %(name)s!'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /a real run would send nothing for "Welcome back, %\(name\)s!" — up to date \(translated, and its source has not changed\)\. The request below is what re-translating it would send; `champollion sync --pair en:fr --redo 'keys:django::Welcome back\\, %\(name\)s!' --fresh` sends it\. Nothing is sent now\./);
      assert.match(r.out, /Request preview — en:fr, fr\/LC_MESSAGES\/django\.po, the key you named \(1\)/);
      const unknown = await runCli(['sync', '--dry', '--show-prompt', 'No such string'], d, env);
      assert.match(unknown.out, /--show-prompt "No such string": no key by that name in the source files/);
      const bare = await runCli(['sync', '--dry', '--show-prompt'], d, env);
      assert.match(bare.out, /Nothing to preview: no file would send anything to the model/);
      assert.equal(model.calls.length, before, 'nothing reached the model');
    } finally {
      await model.close();
    }
  });

  it('an entry makemessages marked fuzzy is reported as fuzzy, re-translated, and the flag cleared', async () => {
    const model = await startFakeModel(translate);
    try {
      const d = django();
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['init', '--yes', '--langs', 'fr', '--method', 'local', '--model', 'stub-1'], d, env)).code, 0);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      // The source msgid changed; makemessages carried the old translation over as fuzzy.
      const src = read(path.join(d, 'locale/en/LC_MESSAGES/django.po')).replace('Welcome back, %(name)s!', 'Welcome back again, %(name)s!');
      write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), src);
      write(path.join(d, 'locale/fr/LC_MESSAGES/django.po'), fr(d).replace(
        'msgid "Welcome back, %(name)s!"', '#, fuzzy\n#| msgid "Welcome back, %(name)s!"\nmsgid "Welcome back again, %(name)s!"'));
      const r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /fr\/LC_MESSAGES\/django\.po — 1 fuzzy \(source changed — re-translating\)/);
      assert.doesNotMatch(r.out, /django\.po — 1 missing/);
      assert.doesNotMatch(fr(d), /#, fuzzy/);
      const dry = await runCli(['sync', '--dry'], d, env);
      assert.doesNotMatch(dry.out, /fuzzy/, 'settled');
    } finally {
      await model.close();
    }
  });
});

// ── 7 + 8 + 9. Next.js: which model wrote the files ─────────────────────────
describe('Round 6 — Next.js: the model that wrote each value is recorded; a plain sync says when it is not the configured one', () => {
  const src = {};
  for (let i = 0; i < 5; i++) src[`k${i}`] = `Add item number ${i} to your cart today`;
  function next() {
    const d = tmp('next');
    writeJSON(path.join(d, 'messages/en.json'), src);
    const cfg = (model) => writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'messages', languages: ['fr'], defaultMethod: 'local', model });
    return { d, cfg };
  }

  it('stub-1 → stub-2 (redo, identical text) → stub-3: status names stub-2; a plain sync says so in one line; the warning wording matches the $0 estimate', async () => {
    // Every model writes the same text: only the record can tell them apart.
    const model = await startFakeModel((k, s) => `FR ${s}`);
    try {
      const { d, cfg } = next();
      const env = { LOCAL_API_BASE: model.url };
      cfg('stub-1');
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      cfg('stub-2');
      const redo = await runCli(['sync', '--redo', 'all', '--fresh-on-model-change'], d, env);
      assert.equal(redo.code, 0, redo.out);
      assert.match(redo.out, /that text is sent to the model again, at the method's price \(the estimate below; \$0 API cost for a model on this machine\)/);
      assert.doesNotMatch(redo.out, /is billed/);
      assert.match(redo.out, /\$0 \(local\)/);
      const lock = readJSON(path.join(d, '.champollion.lock'));
      assert.deepEqual(lock.locales.fr.by, { 'local|stub-2|formal-vous|': ['k0', 'k1', 'k2', 'k3', 'k4'] });

      cfg('stub-3');
      const plain = await runCli(['sync'], d, env);
      assert.equal(plain.code, 0, plain.out);
      assert.match(plain.out, /en:fr: 5 translation\(s\) in the files were written by stub-2 \(5\), not the configured model \(stub-3\) — a model change alone re-translates nothing\. To re-translate them with it: `champollion sync --pair en:fr --redo all --fresh-on-model-change`/);
      assert.equal((plain.out.match(/were written by stub-2/g) || []).length, 1, 'one line');
      const status = await runCli(['status'], d, env);
      assert.match(status.out, /earlier model: every translation in the files that can be attributed \(5 keys\) came from stub-2, not the current model \(stub-3\)/);
      assert.doesNotMatch(status.out, /stub-1/);

      // Values written before this release (no record): two models cached the
      // same text, so the model is unknown — not guessed.
      delete lock.locales.fr.by;
      writeJSON(path.join(d, '.champollion.lock'), lock);
      const legacy = await runCli(['status'], d, env);
      assert.match(legacy.out, /model unknown: 5 keys hold text that stub-1 and stub-2 cached identically, so which of them wrote it cannot be told \(the current model is stub-3\)/);
      const json = JSON.parse((await runCli(['status', '--json'], d, env)).stdout);
      const pair = json.pairs.find(p => p.target === 'fr');
      assert.equal(pair.fromEarlierModel, null);
      assert.deepEqual(pair.modelsInFiles, [{ model: 'model unknown', keys: 5, current: false, unknown: true, candidates: ['stub-1', 'stub-2'] }]);
    } finally {
      await model.close();
    }
  });
});

// ── 14. The pair pipeline is public API and reads the project from options.cwd ─
describe('Round 6 — translateWithFallback (public API) reads the project directory from options.cwd, not process.cwd()', () => {
  it('the endpoint in the project\'s .env is used though the process runs elsewhere', async () => {
    const api = await import('../index.js');
    assert.equal(typeof api.translateWithFallback, 'function');
    assert.equal(typeof api.createFallbackBudget, 'function');
    const model = await startFakeModel((k, s) => `FR ${s}`);
    const saved = {};
    for (const k of ['LOCAL_API_BASE', 'OPENAI_API_BASE', 'OPENAI_BASE_URL']) { saved[k] = process.env[k]; delete process.env[k]; }
    try {
      const d = tmp('cwd');
      write(path.join(d, '.env'), `LOCAL_API_BASE=${model.url}\n`);
      writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'messages', languages: ['fr'], defaultMethod: 'local', model: 'stub-1' });
      writeJSON(path.join(d, 'messages/en.json'), { a: 'Hello there my friend' });
      assert.notEqual(process.cwd(), d);
      const pc = [...api.resolvePairs(api.resolveConfig({}, d)).values()].find(p => p.target === 'fr');
      const tm = api.loadTM(d);
      const result = await api.translateWithFallback(['a'], { a: 'Hello there my friend' }, pc, 'en:fr', {
        tm, targetCode: 'fr', cwd: d, onProgress: null,
      });
      assert.deepEqual(result.translated, { a: 'FR Hello there my friend' });
      assert.equal(model.calls.length, 1, 'the project\'s endpoint got the request');
      assert.equal(result.producedBy.a, api.tmMethodKey(pc));
    } finally {
      for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
      await model.close();
    }
  });
});
