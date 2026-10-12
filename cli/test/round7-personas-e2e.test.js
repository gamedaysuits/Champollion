/**
 * Round 7 synthetic developers — i18next (plural forms and CI), Next.js
 * (model and method switches, the MCP tool), Django (gettext contexts, redo
 * by name, CI), the hospital (corpus registration, an unconfirmed variety)
 * and the school (a newsletter content lane) — end to end through the real
 * CLI (bin/cli.js) against a tiny local model
 * (test/fixtures/fake-openai-model.mjs). No network, no key.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { resolveLanguageInput, findLanguagesByName } from '../lib/registers.js';

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), `r7-${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const readJSON = (file) => JSON.parse(read(file));
const writeJSON = (file, obj) => write(file, JSON.stringify(obj, null, 2));
/** Copy a project the way `git clone` would: committed files only (no .champollion/ cache). */
function cloneWithoutCache(from) {
  const to = tmp('clone');
  fs.cpSync(from, to, { recursive: true, filter: (src) => !src.split(path.sep).includes('.champollion') });
  return to;
}

// ── 1. Language names → the project's own codes (the CLI half of the MCP fix) ─
describe('Round 7 — Next.js: a language NAME resolves to a code, and to the project\'s own spelling', () => {
  it('names, other codes for the same language, and the project\'s locales', () => {
    assert.deepEqual(findLanguagesByName('french').map(f => f.code), ['fra'], 'a language card, never its locale projections');
    assert.equal(findLanguagesByName('French')[0].tag, 'fr', 'BCP 47: the two-letter code where one exists');
    const L = ['en', 'fr'];
    assert.equal(resolveLanguageInput('French', { locales: L }).code, 'fr');
    assert.equal(resolveLanguageInput('English', { locales: L }).code, 'en');
    assert.equal(resolveLanguageInput('fra', { locales: L }).code, 'fr');
    assert.equal(resolveLanguageInput('French').code, 'fr', 'no project: the code for the language');
    assert.equal(resolveLanguageInput('Plains Cree').code, 'crk');
    assert.equal(resolveLanguageInput('qaa').code, 'qaa', 'a private-use code passes as written');
    assert.equal(resolveLanguageInput('x-pirate').code, 'x-pirate');
    assert.match(resolveLanguageInput('Frnch').error, /neither a language code nor the name/);
    const two = resolveLanguageInput('French', { locales: ['en', 'fr', 'fr-CA'] });
    assert.deepEqual(two.candidates, ['fr', 'fr-CA'], 'two project locales: never picks');
  });
});

// ── 2 + 3. A borrowed plural form equal to its source form: decided from the lock ─
describe('Round 7 — i18next: "_many equals _other" is decided from committed files, the same on every clone', () => {
  const SRC = { recipes_one: '{{count}} recipe', recipes_other: '{{count}} recipes', title: 'My family cookbook' };
  // A model that, asked for the French many form, writes it like other —
  // which French may do. (Asked AS that form: the request names it.)
  const alike = (k, src) => {
    if (k.endsWith('_one')) return '{{count}} recette';
    if (k.endsWith('_many') || k.endsWith('_other')) return '{{count}} recettes';
    return `FR ${src}`;
  };
  function project() {
    const d = tmp('i18n');
    writeJSON(path.join(d, 'public/locales/en/common.json'), SRC);
    writeJSON(path.join(d, 'champollion.config.json'), {
      inputLocale: 'en', localesDir: 'public/locales', languages: ['fr'], defaultMethod: 'local', model: 'stub-1',
    });
    return d;
  }
  const lockOf = (d) => readJSON(path.join(d, '.champollion.lock'));

  it('the model asked for _many wrote it like _other: recorded in the lock; verify --strict passes on the machine that translated it AND on a clone with no cache', async () => {
    const model = await startFakeModel(alike);
    try {
      const d = project();
      const env = { LOCAL_API_BASE: model.url };
      const first = await runCli(['sync'], d, env);
      assert.equal(first.code, 0, first.out);
      assert.ok(model.calls.some(c => c.keys.includes('recipes_many') && /many/i.test(c.prompt)), 'the request names the form');
      const lock = lockOf(d);
      assert.match(lock.locales.fr.forms['common::recipes_many'], /^many:[0-9a-f]{12}$/, 'the forms-record');
      const clone = cloneWithoutCache(d);
      assert.equal(fs.existsSync(path.join(clone, '.champollion')), false);
      const here = await runCli(['verify', '--strict'], d, env);
      const there = await runCli(['verify', '--strict'], clone, env);
      for (const v of [here, there]) {
        assert.equal(v.code, 0, v.out);
        assert.doesNotMatch(v.out, /hold the same text as the form they are translated from/);
        assert.doesNotMatch(v.out, /until this release/, 'a brand-new project has no old data to warn about');
      }
      // A redo served from the cache keeps the record (the value did not change).
      assert.equal((await runCli(['sync', '--redo', 'all'], d, env)).code, 0);
      assert.equal(lockOf(d).locales.fr.forms['common::recipes_many'], lock.locales.fr.forms['common::recipes_many']);
    } finally {
      await model.close();
    }
  });

  it('a value written before the record existed: one info line (never a warning, never cache-dependent), the same on both clones — and only then "before each form had its own cache entry"', async () => {
    const model = await startFakeModel(alike);
    try {
      const d = project();
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      // The lock an earlier build left: a written-record, no forms-record.
      const lock = lockOf(d);
      delete lock.locales.fr.forms;
      writeJSON(path.join(d, '.champollion.lock'), lock);
      const clone = cloneWithoutCache(d);
      const here = await runCli(['verify', '--strict'], d, env);
      const there = await runCli(['verify', '--strict'], clone, env);
      for (const v of [here, there]) {
        assert.equal(v.code, 0, `an info line does not fail --strict\n${v.out}`);
        assert.match(v.stdout, /\[VERIFY\] fr: common: 1 plural form\(s\) hold the same text as the form they are translated from: recipes_many = recipes_other \("\{\{count\}\} recettes"\) — written before each form had its own cache entry, when a cached answer for one form could be written into both \(fr uses many \(1000000\)\)\. If they should differ, ask again: `champollion sync --pair en:fr --redo keys:common::recipes_many` \(sends 1 key\(s\) to the model\)/);
      }
      const strip = (s) => s.replace(/\(\d+(\.\d+)?m?s\)/g, '');
      assert.equal(strip(here.out), strip(there.out), 'the same verify output on both clones');
    } finally {
      await model.close();
    }
  });
});

// ── 4. status names the address `local` will call, and where it came from ────
describe('Round 7 — i18next: status shows the endpoint the local method calls', () => {
  function project() {
    const d = tmp('status');
    writeJSON(path.join(d, 'messages/en.json'), { save: 'Save changes' });
    writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'messages', languages: ['fr'], defaultMethod: 'local' });
    return d;
  }
  it('the default (Ollama), LOCAL_API_BASE in .env, and LOCAL_API_BASE in the environment', async () => {
    const d = project();
    const plain = await runCli(['status'], d);
    assert.match(plain.out, /method: local .*\n\s+endpoint: http:\/\/localhost:11434\/v1 \(from the default, Ollama\)/);
    write(path.join(d, '.env'), 'LOCAL_API_BASE=http://127.0.0.1:8378/v1\n');
    const dotenv = await runCli(['status'], d);
    assert.match(dotenv.out, /endpoint: http:\/\/127\.0\.0\.1:8378\/v1 \(from LOCAL_API_BASE in \.env\)/);
    const json = await runCli(['status', '--json'], d, { LOCAL_API_BASE: 'http://10.1.2.3:8000/v1/' });
    const pair = JSON.parse(json.stdout).pairs[0];
    assert.deepEqual(pair.requestsGoTo, { url: 'http://10.1.2.3:8000/v1', from: 'LOCAL_API_BASE' }, 'the environment wins over .env');
  });
});

// ── 5–7. Model and method switches: said before the estimate, said at all, said right ─
describe('Round 7 — Next.js: model and method switches', () => {
  const answer = (k, s, { model }) => `${model === 'm2' ? 'M2' : 'FR'} ${s}`;
  async function synced(model) {
    const d = tmp('switch');
    writeJSON(path.join(d, 'messages/en.json'), { save: 'Save changes', remove: 'Delete account' });
    writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'messages', languages: ['fr'], defaultMethod: 'local', model: 'm1' });
    const env = { LOCAL_API_BASE: model.url };
    assert.equal((await runCli(['sync'], d, env)).code, 0);
    return { d, env };
  }

  it('5: translations reused from the previous model are said BEFORE the cost estimate', async () => {
    const model = await startFakeModel(answer);
    try {
      const { d, env } = await synced(model);
      writeJSON(path.join(d, 'messages/fr.json'), { save: 'FR Save changes' }); // one key to fill
      const dry = await runCli(['sync', '--dry', '--model', 'm2'], d, env);
      const notice = dry.out.indexOf('Model changed: 1 translation this run needs (1 string in fr) is served from the previous model');
      const table = dry.out.indexOf('Estimated translation cost:');
      assert.ok(notice >= 0 && table > notice, dry.out);
      assert.match(dry.out, /To have the new model translate them instead: --redo all --fresh-on-model-change \(it sends what an earlier model translated/);
    } finally {
      await model.close();
    }
  });

  it('6: a dry run that switches METHOD says the files keep the other method\'s text, and the redo with its cost', async () => {
    const model = await startFakeModel(answer);
    try {
      const { d, env } = await synced(model);
      const dry = await runCli(['sync', '--dry', '--method', 'llm'], d, env);
      assert.match(dry.out, /fr\.json — fully synced/);
      assert.match(dry.out, /en:fr: 2 translation\(s\) in the files were written by local · model m1 · register formal-vous \(2\), not by llm · model m1 · register formal-vous \(as this run sets it\)\. Nothing would change: a change of method, register or coaching re-translates nothing on its own — the files keep the other text\. To have llm translate them: `champollion sync --pair en:fr --method llm --redo all` — sends 2 key\(s\) to llm \((est\. ~\$|cost unknown)/);
      // Run with the configured method: nothing to say.
      const plain = await runCli(['sync', '--dry'], d, env);
      assert.doesNotMatch(plain.out, /were written by local/);
    } finally {
      await model.close();
    }
  });

  it('7: --model X is "the model for this run", and the redo says what it sends', async () => {
    const model = await startFakeModel(answer);
    try {
      const { d, env } = await synced(model);
      const dry = await runCli(['sync', '--dry', '--model', 'm2'], d, env);
      assert.match(dry.out, /2 translation\(s\) in the files were written by m1 \(2\), not the model for this run \(--model m2\) — a model change alone re-translates nothing\. To re-translate them with it: `champollion sync --pair en:fr --model m2 --redo all --fresh-on-model-change` \(sends up to 2 key\(s\) an earlier model wrote — \$0 API cost \(runs on this machine\); what this model already translated comes from the cache\)/);
      assert.doesNotMatch(dry.out, /the configured model/);
      const cfg = readJSON(path.join(d, 'champollion.config.json'));
      writeJSON(path.join(d, 'champollion.config.json'), { ...cfg, model: 'm2' });
      const configured = await runCli(['sync', '--dry'], d, env);
      assert.match(configured.out, /not the configured model \(m2\)/);
      const status = await runCli(['status'], d, env);
      assert.match(status.out, /came from m1, not the current model \(m2\)\. To have the current model translate them: champollion sync --pair en:fr --redo all --fresh-on-model-change/);
      assert.doesNotMatch(status.out, /re-translate it all/);
    } finally {
      await model.close();
    }
  });
});

// ── 8–10. Django: redo by name — a name that matches nothing fails; a cached answer is said ─
const DJANGO_EN = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: en\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

msgctxt "button"
msgid "Cancel"
msgstr ""

msgctxt "status"
msgid "Cancel"
msgstr ""

msgid "Save changes"
msgstr ""
`;

async function djangoProject(model) {
  const d = tmp('django');
  write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), DJANGO_EN);
  const env = { LOCAL_API_BASE: model.url };
  const init = await runCli(['init', '--yes', '--langs', 'fr', '--method', 'local', '--model', 'stub-1'], d, env);
  assert.equal(init.code, 0, init.out);
  assert.equal((await runCli(['sync'], d, env)).code, 0);
  return { d, env };
}
const dj = (k, src) => ({ Cancel: 'Annuler', 'Save changes': 'Enregistrer' })[src] ?? `FR ${src}`;

describe('Round 7 — Django: --redo keys: by name', () => {
  it('8: a msgid that only exists WITH a context, or a typo: exit 1, the closest keys in both spellings, nothing sent', async () => {
    const model = await startFakeModel(dj);
    try {
      const { d, env } = await djangoProject(model);
      const before = model.calls.length;
      for (const args of [['sync', '--redo', 'keys:Cancel'], ['sync', '--force-keys', 'Cancel']]) {
        const r = await runCli(args, d, env);
        assert.equal(r.code, 1, r.out);
        assert.match(r.out, /names "Cancel", which matches no key in the source files — closest: `django::button␄Cancel` \(or type `django::button\\x04Cancel`\), `django::status␄Cancel` \(or type `django::status\\x04Cancel`\)/);
        assert.match(r.out, /type the ␄ as \\x04 if you cannot \(both spellings work\)/);
        assert.match(r.out, /Nothing was translated or sent/);
        assert.doesNotMatch(r.out, /fully synced/);
      }
      const typo = await runCli(['sync', '--redo', 'keys:Save chnages'], d, env);
      assert.equal(typo.code, 1, typo.out);
      assert.match(typo.out, /names "Save chnages", which matches no key .* closest: `django::Save changes`/);
      assert.equal(model.calls.length, before, 'nothing was sent');
    } finally {
      await model.close();
    }
  });

  it('8: some names match: those are redone, then the run fails naming the rest', async () => {
    const model = await startFakeModel(dj);
    try {
      const { d, env } = await djangoProject(model);
      const r = await runCli(['sync', '--redo', 'keys:django::button␄Cancel,Nope', '--fresh'], d, env);
      assert.equal(r.code, 1, r.out);
      assert.match(r.out, /Redoing the 1 named key\(s\) that exist; the run then fails \(exit 1\) for the 1 that do not/);
      assert.ok(model.calls.at(-1).prompt.includes('Cancel'), 'the matching key was asked');
      const tail = r.out.slice(r.out.lastIndexOf('[OK]') >= 0 ? r.out.lastIndexOf('Would') : 0);
      assert.match(r.out.split('\n').filter(Boolean).at(-1), /names "Nope", which matches no key/, `said last\n${tail}`);
      // Both spellings name the same key.
      const typed = await runCli(['sync', '--redo', 'keys:django::status\\x04Cancel'], d, env);
      assert.equal(typed.code, 0, typed.out);
    } finally {
      await model.close();
    }
  });

  it('9: a redo without --fresh served from the cache says so, with the --fresh command and its cost', async () => {
    const model = await startFakeModel(dj);
    try {
      const { d, env } = await djangoProject(model);
      const before = model.calls.length;
      const r = await runCli(['sync', '--redo', 'keys:django::button␄Cancel'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.equal(model.calls.length, before, 'the cache answered');
      assert.match(r.out, /1 key\(s\) named for a redo were served from the cache, not asked again \(django::button␄Cancel\) — the file already holds that text: a redo re-checks and re-writes what the cache holds, at no cost\. To ask the model again: `champollion sync --pair en:fr --redo 'keys:django::button␄Cancel' --fresh  # type ␄ as \\x04 if you cannot \(both work\)` \(sends 1 key\(s\) — \$0 API cost \(runs on this machine\)\)/);
      const dry = await runCli(['sync', '--dry', '--redo', 'keys:django::button␄Cancel'], d, env);
      assert.match(dry.out, /1 key\(s\) named for a redo would be served from the cache/);
      const fresh = await runCli(['sync', '--redo', 'keys:django::button␄Cancel', '--fresh'], d, env);
      assert.equal(fresh.code, 0, fresh.out);
      assert.equal(model.calls.length, before + 1, '--fresh asks the model');
      assert.doesNotMatch(fresh.out, /served from the cache, not asked again/);
    } finally {
      await model.close();
    }
  });
});

// ── 11–14. Django: plural gaps are incomplete for audit too; the CI page; the verify heading ─
const DJANGO_RU = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: en\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

#, python-format
msgid "One appointment booked today"
msgid_plural "%(count)d appointments booked today"
msgstr[0] ""
msgstr[1] ""

msgid "Save changes"
msgstr ""
`;

describe('Round 7 — Django: what verify --strict fails on, audit counts', () => {
  // A model that leaves out Russian few/many (only one/other).
  const lazy = (k, src) => (src.startsWith('{n, plural')
    ? '{n, plural, one {Одна запись сегодня} other {%(count)d записей сегодня}}'
    : 'Сохранить изменения');

  it('11: Russian plural forms the model left out — verify warns, verify --strict fails, audit is not "fully translated" and names the repair', async () => {
    const model = await startFakeModel(lazy);
    try {
      const d = tmp('django-ru');
      write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), DJANGO_RU);
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['init', '--yes', '--langs', 'ru', '--method', 'local', '--model', 'stub-1'], d, env)).code, 0);
      await runCli(['sync'], d, env);
      assert.match(read(path.join(d, 'locale/ru/LC_MESSAGES/django.po')), /# champollion:/);
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 0, v.out);
      assert.match(v.stderr, /repeat the "other" form/);
      const strict = await runCli(['verify', '--strict'], d, env);
      assert.equal(strict.code, 1, strict.out);
      const audit = await runCli(['audit'], d, env);
      assert.equal(audit.code, 1, audit.out);
      assert.doesNotMatch(audit.out, /fully translated/);
      assert.match(audit.out, /ru\/LC_MESSAGES\/django\.po: 1 plural message\(s\) without a form ru uses for ordinary counts — the "other" form is shown instead\n\s+- django::One appointment booked today \(few, many\)/);
      assert.match(audit.out, /Repair: `champollion sync --pair en:ru --redo 'keys:django::One appointment booked today' --fresh` \(or write the forms by hand and delete the "# champollion:" line above each entry\)/);
      assert.match(audit.out, /Total: 0 keys need translation, 1 plural message\(s\) missing everyday forms\./);
      const json = await runCli(['audit', '--json'], d, env);
      const summary = json.stdout.trim().split('\n').map(l => JSON.parse(l)).find(o => o.level === 'summary');
      assert.equal(summary.pluralGapCount, 1);
    } finally {
      await model.close();
    }
  });

  it('14: standalone verify says "Verification"; after a sync it says "Post-Sync Verification"', async () => {
    const model = await startFakeModel((k, src) => (src.startsWith('{n, plural')
      ? '{n, plural, one {Одна запись} few {%(count)d записи} many {%(count)d записей} other {%(count)d записи}}'
      : 'Сохранить изменения'));
    try {
      const d = tmp('django-head');
      write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), DJANGO_RU);
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['init', '--yes', '--langs', 'ru', '--method', 'local', '--model', 'stub-1'], d, env)).code, 0);
      const sync = await runCli(['sync'], d, env);
      assert.match(sync.out, /── Post-Sync Verification ─/);
      const v = await runCli(['verify'], d, env);
      assert.match(v.out, /── Verification ─/);
      assert.doesNotMatch(v.out, /Post-Sync/);
      // A complete catalog: audit and verify --strict agree it is done.
      assert.equal((await runCli(['audit'], d, env)).code, 0);
      assert.equal((await runCli(['verify', '--strict'], d, env)).code, 0);
    } finally {
      await model.close();
    }
  });
});

describe('Round 7 — Django: the CI page and the frameworks page', () => {
  const doc = (rel) => read(new URL(`../website/docs/${rel}`, import.meta.url));
  it('12: the Django workflow updates apt first, refreshes djangojs, names the settings env vars, and gates with verify --strict', () => {
    const guide = doc('guides/ci-cd.md');
    const wf = guide.slice(guide.indexOf('i18n-sync.yml (Django)'), guide.indexOf('```', guide.indexOf('i18n-sync.yml (Django)') + 40));
    assert.match(wf, /sudo apt-get update && sudo apt-get install -y gettext/);
    assert.match(wf, /makemessages --all --no-wrap -d djangojs/);
    assert.match(wf, /DJANGO_SETTINGS_MODULE:/);
    assert.match(wf, /champollion@0\.5 verify --strict\n/);
    // Round 8: compilemessages imports the settings too — set at the job level.
    assert.match(guide, /`makemessages` and `compilemessages` both import your settings/);
  });
  it('13: both pages carry the licence line (noncommercial; nothing about buying a licence)', () => {
    for (const page of ['guides/ci-cd.md', 'integrations/frameworks.md']) {
      const text = doc(page);
      assert.match(text, /source-available under the \[PolyForm Noncommercial License 1\.0\.0\]\(https:\/\/github\.com\/gamedaysuits\/Champollion\/blob\/main\/cli\/LICENSE\)/, page);
      assert.doesNotMatch(text, /commercial licen[cs]e (is )?available|contact us for a commercial|buy a licen/i, page);
    }
    const fw = doc('integrations/frameworks.md');
    const django = fw.slice(fw.indexOf('## Django and gettext'), fw.indexOf('### Project structure', fw.indexOf('## Django and gettext')));
    assert.match(django, /PolyForm Noncommercial/);
  });
});

// ── 15–16. Hospital: the register-corpus hint is copyable; a private-use code works end to end ─
describe('Round 7 — hospital: corpus registration and an unconfirmed variety', () => {
  const TSV = 'source\treference\nGood morning\tMagandang umaga po\nHow are you feeling?\tKumusta po kayo?\n';

  it('15: the "Next" hint is filled from the card — names, codes, the file — no <src>/<tgt>', async () => {
    const d = tmp('corpus');
    write(path.join(d, 'data/ward.tsv'), TSV);
    writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'messages', languages: ['crk'], defaultMethod: 'local', model: 'llama3.1' });
    const r = await runCli(['network', 'register-corpus', '--yes', '--name', 'Ward phrases', '--pair', 'eng>crk', '--role', 'test',
      '--data', 'data/ward.tsv', '--domain', 'medical', '--license', '8'], d);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /mt-eval run --corpus data\/ward\.tsv --provider local --model llama3\.1 --source-lang English --target-lang 'Plains Cree' --source-code eng --target-lang-code crk\n/);
    assert.doesNotMatch(r.out, /<src>|<tgt>/);
  });

  it('16: qaa (private use) with a display name — init, sync, verify, register-corpus all accept it; switching to the real code later keeps the translations', async () => {
    const model = await startFakeModel((k, s) => `AYT ${s}`);
    try {
      const d = tmp('qaa');
      writeJSON(path.join(d, 'messages/en.json'), { greet: 'Good morning, how are you feeling today?' });
      const env = { LOCAL_API_BASE: model.url };
      const init = await runCli(['init', '--yes', '--langs', 'qaa', '--method', 'local', '--model', 'stub-1'], d, env);
      assert.equal(init.code, 0, init.out);
      const cfg = readJSON(path.join(d, 'champollion.config.json'));
      writeJSON(path.join(d, 'champollion.config.json'), { ...cfg, languages: { qaa: { name: 'Ayta (variety not yet confirmed)' } } });
      const sync = await runCli(['sync'], d, env);
      assert.equal(sync.code, 0, sync.out);
      assert.ok(model.calls.at(-1).prompt.includes('Ayta (variety not yet confirmed)') || model.calls.at(-1).system.includes('Ayta (variety not yet confirmed)'),
        'the model is told the display name');
      assert.equal(readJSON(path.join(d, 'messages/qaa.json')).greet, 'AYT Good morning, how are you feeling today?');
      assert.equal((await runCli(['verify', '--strict'], d, env)).code, 0);
      write(path.join(d, 'data/ward.tsv'), TSV);
      const reg = await runCli(['network', 'register-corpus', '--yes', '--name', 'Ward phrases', '--pair', 'eng>qaa', '--role', 'test',
        '--data', 'data/ward.tsv', '--domain', 'medical', '--license', '8'], d, env);
      assert.equal(reg.code, 0, reg.out);
      assert.match(reg.out, /--target-lang 'Ayta \(variety not yet confirmed\)' --source-code eng --target-lang-code qaa/, 'the project\'s name for the code');
      // The real code, later: config + file rename. Nothing is sent again.
      writeJSON(path.join(d, 'champollion.config.json'), { ...cfg, languages: ['ayt'] });
      fs.renameSync(path.join(d, 'messages/qaa.json'), path.join(d, 'messages/ayt.json'));
      const before = model.calls.length;
      const after = await runCli(['sync'], d, env);
      assert.equal(after.code, 0, after.out);
      assert.equal(model.calls.length, before, 'the translations stay valid');
      assert.equal(readJSON(path.join(d, 'messages/ayt.json')).greet, 'AYT Good morning, how are you feeling today?');
      const again = await runCli(['network', 'register-corpus', '--yes', '--name', 'Ward phrases', '--pair', 'eng>ayt', '--role', 'test',
        '--data', 'data/ward.tsv', '--domain', 'medical', '--license', '8'], d, env);
      assert.match(again.out, /To register the file under a new id:\s+--id eval-eng-ayt-ward-phrases-test-v1/);
    } finally {
      await model.close();
    }
  });

  it('16: the guide says what to do while the variety is unconfirmed', () => {
    const guide = read(new URL('../website/docs/build-mt-for-your-language.md', import.meta.url));
    const sec = guide.slice(guide.indexOf('### When the variety is not confirmed yet'), guide.indexOf('## 2.'));
    assert.match(sec, /Ask the speakers\s+first/);
    assert.match(sec, /`qaa` to `qtz`/);
    for (const cost of [/No card facts/, /No FST/, /No prior results/]) assert.match(sec, cost);
    assert.match(sec, /register-corpus --pair "eng>ayt"/);
    assert.ok(guide.indexOf('### When the variety is not confirmed yet') < guide.indexOf('## 2.'), 'in step 1');
  });
});

// ── 17–19. School: the newsletter goes through the same gate; one repair; status shows it ─
describe('Round 7 — school: a newsletter (contentDir) beside the app', () => {
  const SENT = 'Le grand festin communautaire de notre école aura lieu ce soir';
  const NEWSLETTER = '---\ntitle: "October news"\n---\n\n## Feast\n\nThe science fair is on Friday, and every class will present a project to the families.\n';
  // The trained model: a short string becomes a whole sentence. The fallback translates.
  const forge = (k, s, { model }) => {
    const heading = /^#+ /.exec(s)?.[0] || '';
    const text = s.slice(heading.length);
    if (model === 'fb-1') return `${heading}FB ${text}`;
    return text.length < 12 ? `${heading}${SENT}` : `FR ${s}`;
  };
  function school({ fallback = false } = {}) {
    const d = tmp('school');
    writeJSON(path.join(d, 'messages/en.json'), { Nav: { home: 'Feast' } });
    write(path.join(d, 'newsletter/2026-10.md'), NEWSLETTER);
    writeJSON(path.join(d, 'champollion.config.json'), {
      inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'forge-1', contentDir: 'newsletter',
      languages: fallback ? { fr: { fallback: { method: 'local', model: 'fb-1' } } } : ['fr'],
    });
    return d;
  }
  const frPage = (d) => read(path.join(d, 'newsletter/2026-10.fr.md'));

  it('17: "## Feast" turned into a sentence is refused in the newsletter exactly as for the app key — never written, never cached', async () => {
    const model = await startFakeModel(forge);
    try {
      const d = school();
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url });
      assert.match(r.out, /Nav\.home: length inflation \(12\.4x source, max 4x\)/, 'the app key');
      assert.match(r.out, /1 block\(s\) of 2026-10\.md refused by the quality gate, also when asked again with the reason — paragraph 1: length inflation \(8\.1x source, max 4x\)/, 'the heading, by the same check');
      assert.doesNotMatch(frPage(d), new RegExp(SENT), 'not written');
      const tm = readJSON(path.join(d, '.champollion/tm.json'));
      assert.ok(!Object.values(tm).some(e => e && typeof e.t === 'string' && e.t.includes(SENT)), 'not cached');
    } finally {
      await model.close();
    }
  });

  it('17: with a fallback the heading goes to it; a sentence already on disk is named by verify with the repair, which works', async () => {
    const model = await startFakeModel(forge);
    try {
      const d = school({ fallback: true });
      const env = { LOCAL_API_BASE: model.url };
      const r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(frPage(d), /^## FB Feast$/m, 'the fallback\'s heading');
      // What an earlier version wrote: the sentence, accepted.
      write(path.join(d, 'newsletter/2026-10.fr.md'), frPage(d).replace('## FB Feast', `## ${SENT}`));
      const v = await runCli(['verify'], d, env);
      assert.match(v.stderr, /\[VERIFY\] fr: 2026-10\.md: 1 Markdown block\(s\)\/front-matter field\(s\) the quality gate refuses — paragraph 1: length inflation \(8\.1x source, max 4x\) — re-translate: `champollion sync --pair en:fr --redo files:2026-10\.md`/);
      assert.equal((await runCli(['verify', '--strict'], d, env)).code, 1, 'a warning: --strict fails');
      const fix = /re-translate: `(champollion sync [^`]+)`/.exec(v.stderr)[1];
      const repaired = await runCli(fix.split(' ').slice(1), d, env);
      assert.equal(repaired.code, 0, repaired.out);
      assert.match(frPage(d), /^## FB Feast$/m);
      assert.equal((await runCli(['verify', '--strict'], d, env)).code, 0);
    } finally {
      await model.close();
    }
  });

  it('18: a repeated sentence in the front matter — sync and verify print the SAME repair command', async () => {
    const MEM = 'Merci de votre visite à notre école aujourd hui';
    const model = await startFakeModel((k, s) => (s.length < 40 ? MEM : `FR ${s}`));
    try {
      const d = tmp('school-mem');
      writeJSON(path.join(d, 'messages/en.json'), { welcome: 'Welcome to the Riverside School family website' });
      write(path.join(d, 'newsletter/2026-10.md'), '---\ntitle: "October news"\n---\n\n# A busy month ahead\n\n'
        + 'The science fair is on Friday, and every class will present a project to the families.\n');
      writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'messages', languages: ['fr'], defaultMethod: 'local', model: 'stub-1', contentDir: 'newsletter' });
      const env = { LOCAL_API_BASE: model.url };
      const first = await runCli(['sync'], d, env);
      const fromSync = /Check those and ask again: `(champollion sync [^`]+--redo files:[^`]+)`/.exec(first.out)?.[1];
      assert.equal(fromSync, 'champollion sync --pair en:fr --redo files:2026-10.md', first.out);
      const v = await runCli(['verify'], d, env);
      const fromVerify = /(champollion sync [^`]*--redo files:[^`]+)`/.exec(v.out)?.[1];
      assert.equal(fromVerify, fromSync, v.out);
    } finally {
      await model.close();
    }
  });

  it('19: status lists the newsletter folder and each locale\'s files: translated, out of date, pending', async () => {
    const model = await startFakeModel(forge);
    try {
      const d = school({ fallback: true });
      const env = { LOCAL_API_BASE: model.url };
      write(path.join(d, 'newsletter/2026-11.md'), '---\ntitle: "November news"\n---\n\nThe winter concert is on the last Friday of the month, in the gym.\n');
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      write(path.join(d, 'newsletter/2026-10.md'), NEWSLETTER.replace('Friday', 'Thursday')); // out of date now
      write(path.join(d, 'newsletter/2026-12.md'), '---\ntitle: "December news"\n---\n\nThe school closes for the holidays on the twentieth.\n'); // pending
      const st = await runCli(['status'], d, env);
      assert.match(st.out, /Content \(Markdown\): newsletter\/ — 3 source file\(s\)/);
      assert.match(st.out, /fr: 1 translated, 1 out of date \(2026-10\.md\), 1 pending \(2026-12\.md\) — `champollion sync` translates the out-of-date and pending ones/);
      const json = JSON.parse((await runCli(['status', '--json'], d, env)).stdout);
      assert.deepEqual(json.content.locales.fr, { translated: 1, outOfDate: ['2026-10.md'], pending: ['2026-12.md'], unrecorded: [] });
      assert.equal(json.content.dir, 'newsletter');
      assert.equal(json.content.files, 3);
    } finally {
      await model.close();
    }
  });
});
