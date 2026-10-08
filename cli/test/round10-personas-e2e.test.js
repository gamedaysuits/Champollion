/**
 * Round 10 synthetic personas (Next.js, i18next, Django, the hospital, the Cree school):
 * what each command advises must be safe to run, and what each run says
 * must match what it did.
 *
 * End to end through the real CLI (bin/cli.js) against a tiny local model
 * (test/fixtures/fake-openai-model.mjs) where a model is needed. No network,
 * no key.
 *
 * Three groups: the Next.js / i18next / Django / hospital items (1–11)
 * first; then the register-corpus and pair-notation items (12, 16, 17) and
 * the Cree school's fallback-coaching and repeat-check items (13, 14), each
 * in its own block with its own helpers.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { assignInOrder, setNestedValue } from '../lib/flatten.js';
import { diffLabel, queueReasons } from '../lib/diff.js';
import { mergeWizardConfig, buildConfig, describeConfigChanges } from '../lib/commands/init.js';
import { parseLanguagePair, formatLanguagePair, PAIR_NOTATION_HELP } from '../lib/language-pair.js';
import { COMMAND_HELP } from '../lib/command-help.js';
import {
  readPairLines, normalizeSubmissionValues, resolveType, validateSubmission, PAIRS_LABEL, SUBMISSION_TYPES,
} from '../lib/submit.mjs';
import { cacheKey, tmMethodKey } from '../lib/tm.js';
import { resolveConfig } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-round10-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const tmp = (prefix) => fs.mkdtempSync(path.join(ROOT, `${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const readJSON = (file) => JSON.parse(read(file));
const writeJSON = (file, obj) => write(file, `${JSON.stringify(obj, null, 2)}\n`);
const doc = (rel) => read(new URL(`../website/docs/${rel}`, import.meta.url));
/** A runner with none of the CI variables this machine may have set. */
const NO_CI = { CI: '', GITHUB_ACTIONS: '' };
const summaryOf = (stdout) => stdout.trim().split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } })
  .find(o => o && o.level === 'summary');

// ── 1. Next.js: init --force never rewrites what the flags did not name ─────
const NEXT_CONFIG = {
  version: 3,
  inputLocale: 'en',
  localesDir: './messages',
  languages: { fr: 'casual-tu', de: 'formal-sie' },
  batchSize: 40,
  format: 'auto',
  model: 'google/gemini-3.5-flash',
  glossary: { Save: { fr: 'Enregistrer' } },
  pairs: { 'en:de': { fallback: { method: 'deepl' } } },
};

function nextProject(config = NEXT_CONFIG) {
  const d = tmp('next');
  writeJSON(path.join(d, 'messages/en.json'), { save: 'Save your changes', open: 'Open the settings page' });
  writeJSON(path.join(d, 'champollion.config.json'), config);
  return d;
}

describe('Round 10 — Next.js: switching the model never rewrites the config', () => {
  it('1: init --force --method local --model x changes only defaultMethod and model; the register, batchSize, glossary and pairs stay; the old file is backed up', async () => {
    const d = nextProject();
    const original = read(path.join(d, 'champollion.config.json'));
    const r = await runCli(['init', '--force', '--method', 'local', '--model', 'x'], d);
    assert.equal(r.code, 0, r.out);
    const after = readJSON(path.join(d, 'champollion.config.json'));
    assert.deepEqual(after, { ...NEXT_CONFIG, model: 'x', defaultMethod: 'local' });
    assert.equal(after.languages.fr, 'casual-tu', 'the custom register survives');
    assert.equal(after.batchSize, 40, 'batchSize is not reset to the default');
    assert.equal(read(path.join(d, 'champollion.config.json.bak')), original, 'the previous file, byte for byte');
    assert.match(r.out, /Updated champollion\.config\.json — only what the flags ask for; the previous file is in champollion\.config\.json\.bak\./);
    assert.match(r.out, /Changed:\n\s+model: "google\/gemini-3\.5-flash" → "x"\n\s+defaultMethod: \(not set\) → "local"/);
    assert.match(r.out, /Kept as they were: version, inputLocale, localesDir, languages, batchSize, format, glossary, pairs/);
    assert.match(r.out, /Keeping the config's locale layout \("localesDir": "\.\/messages"\)/);
  });

  it('1: the same flags again change nothing and write nothing; other flags later never overwrite the older backup', async () => {
    const d = nextProject();
    const original = read(path.join(d, 'champollion.config.json'));
    assert.equal((await runCli(['init', '--force', '--method', 'local', '--model', 'x'], d)).code, 0);
    const once = read(path.join(d, 'champollion.config.json'));
    const again = await runCli(['init', '--force', '--method', 'local', '--model', 'x'], d);
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /champollion\.config\.json unchanged — it already says what the flags ask for \(nothing written, no backup needed\)/);
    assert.equal(read(path.join(d, 'champollion.config.json')), once);
    assert.ok(!fs.existsSync(path.join(d, 'champollion.config.json.bak.2')));

    const third = await runCli(['init', '--force', '--langs', 'fr,es', '--model', 'y'], d);
    assert.equal(third.code, 0, third.out);
    assert.equal(read(path.join(d, 'champollion.config.json.bak')), original, 'the first backup is never overwritten');
    assert.equal(read(path.join(d, 'champollion.config.json.bak.2')), once);
    assert.match(third.out, /the previous file is in champollion\.config\.json\.bak\.2\./);
    // --langs sets the target list: fr keeps its own register, es gets the
    // default one, de goes. The method set before stays (no --method).
    const now = readJSON(path.join(d, 'champollion.config.json'));
    assert.deepEqual(now.languages, { fr: 'casual-tu', es: 'neutral-latam' });
    assert.equal(now.defaultMethod, 'local');
    assert.equal(now.model, 'y');
    assert.equal(now.batchSize, 40);
    assert.match(third.out, /languages: added es \("neutral-latam"\); removed de/);
  });

  it('1: a new --method without --model takes that method\'s model; --script adds to an existing entry', async () => {
    const d = nextProject({ ...NEXT_CONFIG, defaultMethod: 'local', model: 'm1' });
    const r = await runCli(['init', '--force', '--method', 'llm'], d);
    assert.equal(r.code, 0, r.out);
    const c = readJSON(path.join(d, 'champollion.config.json'));
    assert.equal(c.defaultMethod, undefined, 'llm is the default: not written');
    assert.equal(c.model, 'google/gemini-3.8-flash', 'm1 was the local model, not an OpenRouter one');
    assert.equal(c.languages.fr, 'casual-tu');

    const crk = tmp('crk');
    writeJSON(path.join(crk, 'locales/en.json'), { a: 'Hello' });
    writeJSON(path.join(crk, 'champollion.config.json'), {
      version: 3, inputLocale: 'en', localesDir: './locales', languages: { crk: { name: 'Plains Cree (school)' } }, batchSize: 20, format: 'auto',
    });
    const s = await runCli(['init', '--force', '--yes', '--langs', 'crk', '--script', 'crk=Cans'], crk);
    assert.equal(s.code, 0, s.out);
    const cc = readJSON(path.join(crk, 'champollion.config.json'));
    assert.deepEqual(cc.languages, { crk: { name: 'Plains Cree (school)', script: 'Cans' } });
    assert.equal(cc.batchSize, 20);
  });

  it('1: a config that no longer finds the source is re-detected (what init --force is advised for); the rest stays', async () => {
    const d = nextProject({ ...NEXT_CONFIG, localesDir: './locales-moved' });
    const r = await runCli(['init', '--force'], d);
    assert.equal(r.code, 0, r.out);
    const c = readJSON(path.join(d, 'champollion.config.json'));
    assert.equal(c.localesDir, './messages');
    assert.equal(c.batchSize, 40);
    assert.equal(c.languages.fr, 'casual-tu');
    assert.match(r.out, /localesDir: "\.\/locales-moved" → "\.\/messages"/);
  });

  it('1: a file that is not valid JSON is backed up, and the warning says nothing in it was kept', async () => {
    const d = tmp('corrupt');
    writeJSON(path.join(d, 'messages/en.json'), { a: 'Hello' });
    write(path.join(d, 'champollion.config.json'), '{ "batchSize": 40, ');
    const r = await runCli(['init', '--force', '--yes', '--langs', 'fr'], d);
    assert.equal(r.code, 0, r.out);
    assert.equal(read(path.join(d, 'champollion.config.json.bak')), '{ "batchSize": 40, ');
    assert.match(r.stderr, /champollion\.config\.json could not be read \(.+\), so nothing in it could be kept: wrote a new one from the flags and what is on disk\. The old file is in champollion\.config\.json\.bak — copy back what you need\./);
  });

  it('1: no printed advice re-runs init to change one setting; init without --force says what --force now does', async () => {
    // A fresh project, no key, no targets: method, key and target advice.
    const fresh = tmp('fresh');
    writeJSON(path.join(fresh, 'messages/en.json'), { a: 'Hello' });
    const r = await runCli(['init', '--yes'], fresh, NO_CI);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /init --force/);
    assert.match(r.out, /set "defaultMethod": "local" and "model": "llama3\.1" \(your model's name\) in champollion\.config\.json/);
    assert.match(r.out, /Choose target languages: list them in "languages" in champollion\.config\.json/);
    assert.match(r.out, /Method: llm, model google\/gemini-3\.8-flash\. To use another, edit "defaultMethod" and "model" in champollion\.config\.json/);
    // The two-orthography advice: one field in the file.
    const crk = tmp('crk2');
    writeJSON(path.join(crk, 'locales/en.json'), { a: 'Hello' });
    const c = await runCli(['init', '--yes', '--langs', 'crk'], crk);
    assert.doesNotMatch(c.out, /init --force/);
    assert.match(c.stderr, /add "script" to crk's entry in "languages"/);
    // Over an existing file, without --force.
    const d = nextProject();
    const refused = await runCli(['init', '--yes', '--method', 'local'], d);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /To change a setting, edit it in the file \(e\.g\. "model", "defaultMethod", "languages"\)\./);
    assert.match(refused.out, /--force re-runs init over it: it rewrites only what the flags name, keeps every other\s+setting, prints what changed and backs the file up first/);
    const help = await runCli(['init', '--help'], d);
    assert.match(help.out, /--force\s+Re-run over an existing config: rewrites only what the flags name/);
    assert.match(help.out, /backs the file up first \(champollion\.config\.json\.bak; an older backup is never overwritten/);
  });

  it('1: the wizard over an existing file keeps every field it does not ask about, and each entry\'s other fields', () => {
    const existing = {
      ...NEXT_CONFIG,
      languages: { fr: 'casual-tu', crk: { script: 'Cans', name: 'Plains Cree (school)' } },
      temperature: 0.2,
    };
    // What the wizard answers: Enter on every step (registers prefilled from the file), local model chosen.
    const answered = buildConfig({
      source: 'en', languages: ['fr', 'crk'], defaultMethod: 'local', defaultModel: 'ward-mt',
      perLanguage: null, customRegisters: { fr: 'casual-tu', crk: null }, temperature: 0.2,
      localesDir: './messages', format: 'auto', contentDir: null, scriptChoices: { crk: 'Cans' },
    });
    const merged = mergeWizardConfig(existing, answered);
    assert.equal(merged.batchSize, 40);
    assert.deepEqual(merged.glossary, NEXT_CONFIG.glossary);
    assert.deepEqual(merged.pairs, NEXT_CONFIG.pairs);
    assert.deepEqual(merged.languages, { fr: 'casual-tu', crk: { script: 'Cans', name: 'Plains Cree (school)' } });
    assert.equal(merged.defaultMethod, 'local');
    assert.equal(merged.model, 'ward-mt');
    const { changed, kept } = describeConfigChanges(existing, merged);
    assert.deepEqual(changed, ['model: "google/gemini-3.5-flash" → "ward-mt"', 'defaultMethod: (not set) → "local"']);
    assert.ok(kept.includes('batchSize') && kept.includes('glossary') && kept.includes('languages'));
  });

  it('1: the CLI docs say what init --force keeps, and how to switch model', () => {
    const cli = doc('reference/cli.md');
    assert.match(cli, /\*\*Running `init` again \(`--force`\)\*\*: .*rewrites only what the flags name/);
    assert.match(cli, /copies the previous file to `champollion\.config\.json\.bak` first/);
    assert.match(cli, /--model <model>\s+Translation model for this run only/);
    const tm = doc('concepts/translation-memory.md');
    assert.match(tm, /\*\*How to switch\.\*\* The model is a setting in `champollion\.config\.json`: edit `"model"`/);
    assert.match(tm, /`sync --model <name>` \(and `--method <name>`\) name a model for \*\*one run only\*\*/);
  });
});

// ── 2. Next.js: a one-off --model run is said to be one run ─────────────────
describe('Round 10 — Next.js: sync --model is for one run, and the next sync offers both ways out', () => {
  it('2: the run says the config is not changed; the next plain sync and status offer to keep that model or replace its text', async () => {
    const model = await startFakeModel((k, s, { model: m }) => `FR(${m}) ${s}`);
    try {
      const d = tmp('oneoff');
      writeJSON(path.join(d, 'messages/en.json'), { save: 'Save your changes', open: 'Open the settings page' });
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'm1', languages: ['fr'],
      });
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      const once = await runCli(['sync', '--model', 'm2'], d, env);
      assert.equal(once.code, 0, once.out);
      assert.match(once.out, /--model m2 \(the config says "model": "m1"\): for this run only — champollion\.config\.json is not changed, and a plain `champollion sync` uses it again\. To switch for good, edit "model" in champollion\.config\.json\./);
      assert.equal(readJSON(path.join(d, 'champollion.config.json')).model, 'm1');

      const plain = await runCli(['sync'], d, env);
      assert.equal(plain.code, 0, plain.out);
      assert.match(plain.out, /en:fr: 2 translation\(s\) in the files were written by m2 \(2\), not the configured model \(m1\)/);
      assert.match(plain.out, /To keep m2's text instead and use m2 from now on, set "model": "m2" in champollion\.config\.json \(nothing is sent\)\./);
      const status = await runCli(['status'], d, env);
      assert.match(status.out, /came from m2, not the current model \(m1\)\. To have the current model translate them: champollion sync --pair en:fr --redo all --fresh-on-model-change — or, to keep m2's text, make it the model: "model": "m2" in champollion\.config\.json \(nothing is sent\)/);

      // Keeping it: one field, and nothing is sent; the note is gone.
      const sent = model.calls.length;
      writeJSON(path.join(d, 'champollion.config.json'), { ...readJSON(path.join(d, 'champollion.config.json')), model: 'm2' });
      const kept = await runCli(['sync'], d, env);
      assert.equal(kept.code, 0, kept.out);
      assert.equal(model.calls.length, sent, 'nothing sent');
      assert.doesNotMatch(kept.out, /written by|for this run only/);
    } finally {
      await model.close();
    }
  });
});

// ── 3 + 4. i18next: a restored plural form lands in CLDR order, counted once ─
describe('Round 10 — i18next: verify\'s repair restores plural forms in CLDR order, and counts each key once', () => {
  it('3 + 4: the restored count_many sits between _one and _other in fr as in es; the log says "2 missing", not "+ 2 forced"', async () => {
    const model = await startFakeModel((k, s) => `T ${s}`);
    try {
      const d = tmp('i18next');
      writeJSON(path.join(d, 'public/locales/en/common.json'), {
        title: 'Welcome',
        cart: { count_one: '{{count}} item', count_other: '{{count}} items', empty: 'Empty' },
        file_one: '{{count}} file',
        file_other: '{{count}} files',
        last: 'Bye',
      });
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'public/locales', defaultMethod: 'local', model: 'm1', languages: ['fr', 'es'],
      });
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const fr = path.join(d, 'public/locales/fr/common.json');
      const order = (file) => JSON.stringify(readJSON(file), (k, v) => v, 0).replace(/"[^"]*"\s*:\s*"[^"]*"/g, m => m.split(':')[0]);
      const before = order(fr);
      assert.equal(before, order(path.join(d, 'public/locales/es/common.json')), 'fr and es start in the same order');

      const broken = readJSON(fr);
      delete broken.cart.count_many;
      delete broken.file_many;
      writeJSON(fr, broken);
      const v = await runCli(['verify'], d, env);
      const fix = /fix: `(champollion sync [^`]+)`/.exec(v.out);
      assert.ok(fix, v.out);
      assert.equal(fix[1], 'champollion sync --pair en:fr --redo keys:common::cart.count_many,common::file_many');
      const repaired = await runCli(fix[1].split(' ').slice(1), d, env);
      assert.equal(repaired.code, 0, repaired.out);
      assert.equal(order(fr), before, 'restored in place, nothing else moved');
      assert.deepEqual(Object.keys(readJSON(fr).cart), ['count_one', 'count_many', 'count_other', 'empty']);
      assert.match(repaired.out, /fr\/common\.json — 2 missing\n/);
      assert.doesNotMatch(repaired.out, /forced/);

      // The dry run's lists name each key once, under its first reason.
      writeJSON(fr, broken);
      const dry = await runCli(['sync', '--dry', '--json', '--pair', 'en:fr', '--redo', 'keys:common::cart.count_many'], d, env);
      const json = summaryOf(dry.stdout);
      const q = json.locales[0].queuedKeys;
      assert.deepEqual(q.missing.sort(), ['common::cart.count_many', 'common::file_many']);
      assert.deepEqual(q.forced, []);
    } finally {
      await model.close();
    }
  });

  it('3: the insertion rule — nested and flat keys, ordinal groups, a missing sibling, and nothing else moves', () => {
    const nested = { a: 'x', items_one: '1', items_other: 'n', z: 'y' };
    setNestedValue(nested, 'items_many', 'm');
    assert.deepEqual(Object.keys(nested), ['a', 'items_one', 'items_many', 'items_other', 'z']);
    const flat = { 'cart.title': 't', 'cart.count_one': '1', 'cart.count_other': 'n', 'cart.count_ordinal_one': '1st', 'cart.count_ordinal_other': 'nth' };
    assignInOrder(flat, 'cart.count_few', 'f');
    assignInOrder(flat, 'cart.count_ordinal_two', '2nd');
    assignInOrder(flat, 'cart.count_zero', '0');
    assert.deepEqual(Object.keys(flat), ['cart.title', 'cart.count_zero', 'cart.count_one', 'cart.count_few', 'cart.count_other',
      'cart.count_ordinal_one', 'cart.count_ordinal_two', 'cart.count_ordinal_other']);
    // Only _one on disk: _many goes after it; no sibling at all: at the end.
    const lone = { k_one: '1', other: 'x' };
    assignInOrder(lone, 'k_many', 'm');
    assignInOrder(lone, 'new_key', 'v');
    assert.deepEqual(Object.keys(lone), ['k_one', 'k_many', 'other', 'new_key']);
    // An existing key keeps its place, whatever its category.
    const kept = { k_other: 'n', k_one: '1' };
    assignInOrder(kept, 'k_one', 'one');
    assert.deepEqual(Object.keys(kept), ['k_other', 'k_one']);
  });

  it('4: the label counts each queued key once, under its first reason', () => {
    const diff = { missing: ['a', 'b'], needsTranslation: ['c'], untranslated: [], changed: ['c', 'd'], forced: ['a', 'd', 'e'], noTranslate: [] };
    assert.equal(diffLabel(diff), '2 missing + 1 [EN] fallback(s) + 1 changed + 1 forced');
    assert.deepEqual(queueReasons(diff), { missing: ['a', 'b'], needsTranslation: ['c'], untranslated: [], changed: ['d'], forced: ['e'] });
  });
});

// ── 5 + 8 + 9. The CI guide and the gettext pages ───────────────────────────
describe('Round 10 — CI guide: a push with no source change starts no job; Django\'s settings line is commented', () => {
  const guide = doc('guides/ci-cd.md');
  const block = (title) => {
    const at = guide.indexOf(`\`\`\`yaml title="${title}"`);
    return guide.slice(at, guide.indexOf('```', at + 10));
  };

  it('5: the default workflow filters pushes on the source locale files and the config, not the lock; the prose says why in one line', () => {
    const wf = block('.github/workflows/i18n-sync.yml');
    const on = wf.slice(wf.indexOf('on:'), wf.indexOf('permissions:'));
    // (Round 13: comment lines may introduce workflow_dispatch's redo_gaps input.)
    assert.match(on, /push:\n\s+branches: \[main\]\n(\s+#.*\n)+\s+paths:\n\s+- 'locales\/en\.json'.*\n\s+- 'locales\/en\/\*\*'.*\n\s+- 'champollion\.config\.json'\n(\s+#.*\n)*\s+workflow_dispatch:/);
    assert.doesNotMatch(on, /\.lock/);
    assert.match(guide, /\*\*Only pushes that change a source string start the job\.\*\*/);
    // (Round 14: the bot's own commit never restarts the job because it is pushed with GITHUB_TOKEN — said once, as the reason.)
    assert.match(guide.replace(/\s+/g, ' '), /The filter above leaves out the translated files and the lock files, so the bot's commit starts no run\./);
  });

  it('5: the Django workflow watches code, templates, catalogs and the config (makemessages extracts in the job)', () => {
    const wf = block('.github/workflows/i18n-sync.yml (Django)');
    const on = wf.slice(wf.indexOf('on:'), wf.indexOf('permissions:'));
    for (const p of ["'**.py'", "'**.html'", "'locale/**'", "'champollion.config.json'"]) assert.ok(on.includes(`- ${p}`), p);
    assert.match(guide, /Its `paths:` filter differs from the workflow above: the source strings live in\nyour Python code and templates/);
  });

  it('8: DJANGO_SETTINGS_MODULE is commented out, with when to set it', () => {
    const wf = block('.github/workflows/i18n-sync.yml (Django)');
    assert.match(wf, /\n\s+# DJANGO_SETTINGS_MODULE: myproject\.settings {3}# only if your manage\.py does not set it\n/);
    assert.doesNotMatch(wf, /\n\s+DJANGO_SETTINGS_MODULE:/, 'never set uncommented');
    assert.match(guide, /a value set in the job overrides that one — a wrong module name\nbreaks `makemessages`\. Set it only when your `manage\.py` does not\./);
  });

  it('9: where the docs recommend msgfmt --check-format, they say it checks only python-format entries, and what verify checks', () => {
    for (const [page, text] of [['guides/ci-cd.md', guide], ['getting-started/configuration.md', doc('getting-started/configuration.md')], ['integrations/frameworks.md', doc('integrations/frameworks.md')]]) {
      const flat = text.replace(/\s+/g, ' ');
      assert.match(flat, /only on entries flagged `#, python-format`|checks only entries flagged `#, python-format`/, page);
      assert.match(flat, /`champollion verify` compares every entry's printf placeholders/, page);
      assert.match(flat, /sync keeps the source entry's flags on each entry it translates/, page);
    }
  });
});

// ── 6 + 7 + 9. Django: a file left with a marked gap is never [OK] ──────────
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

msgid "Hello"
msgstr ""

msgid "Hi %(name)s"
msgstr ""
`;

describe('Round 10 — Django: the per-file line and the re-sync summary say what a marked plural gap means', () => {
  it('6 + 7: the first sync marks the file INCOMPLETE; a re-sync says nothing was sent or billed, and why it exits 2, with the repair', async () => {
    const model = await startFakeModel((key, src) => (src.startsWith('{n, plural')
      ? '{n, plural, one {Один файл} other {%(count)d файлов}}'
      : `Привет ${src}`));
    try {
      const d = tmp('django');
      write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), DJANGO_EN);
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['init', '--yes', '--langs', 'ru,fr', '--method', 'local', '--model', 'stub-1'], d, env)).code, 0);
      const first = await runCli(['sync'], d, env);
      assert.equal(first.code, 2, first.out);
      assert.match(first.out, /ru\/LC_MESSAGES\/django\.po \[INCOMPLETE: 2 plural form\(s\) marked "# champollion:"\]/);
      assert.doesNotMatch(first.out, /ru\/LC_MESSAGES\/django\.po \[OK\]/);
      assert.match(first.out, /fr\/LC_MESSAGES\/django\.po \[OK\]/, 'a complete file is still [OK]');

      const calls = model.calls.length;
      const again = await runCli(['sync'], d, env);
      assert.equal(again.code, 2, again.out);
      assert.equal(model.calls.length, calls, 'nothing sent');
      assert.match(again.out, /\[WARN\] ru\/LC_MESSAGES\/django\.po — nothing to translate, but INCOMPLETE: 2 plural form\(s\) marked "# champollion:" \(the "other" form stands in; the repair is below\)/);
      assert.doesNotMatch(again.out, /\[OK\] ru\/LC_MESSAGES\/django\.po — fully synced/);
      assert.match(again.out, /\[OK\] fr\/LC_MESSAGES\/django\.po — fully synced/);
      assert.match(again.out, /Synced 0 key\(s\); 1 plural message\(s\) lack a form the language uses for ordinary counts \(the "other" form stands in — listed above\)\. Nothing was sent to a model and nothing was billed\. The exit code is 2 because of that plural message: write the missing forms by hand \(and delete each "# champollion:" line\), or ask again: `champollion sync --pair en:ru --redo 'keys:django::One file' --fresh`\./);
    } finally {
      await model.close();
    }
  });

  it('9: the translated entry keeps the source\'s python-format flag (and adds none); verify checks placeholders on an unflagged entry', async () => {
    const model = await startFakeModel((key, src) => (src.startsWith('{n, plural')
      ? '{n, plural, one {Un fichier} other {%(count)d fichiers}}'
      : `Bonjour ${src}`));
    try {
      const d = tmp('django-flags');
      write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), DJANGO_EN);
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['init', '--yes', '--langs', 'fr', '--method', 'local', '--model', 'stub-1'], d, env)).code, 0);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const po = path.join(d, 'locale/fr/LC_MESSAGES/django.po');
      const text = read(po);
      assert.match(text, /#, python-format\nmsgid "One file"/, 'kept from the source entry');
      assert.match(text, /\n\nmsgid "Hi %\(name\)s"\nmsgstr "Bonjour Hi %\(name\)s"/, 'no flag added where the source has none');
      // A hand-made catalog's unflagged entry: msgfmt --check-format would
      // skip it; verify does not.
      write(po, text.replace('msgstr "Bonjour Hi %(name)s"', 'msgstr "Bonjour Hi %(name)d"'));
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 1, v.out);
      assert.match(v.out, /printf placeholder %\(name\)s is missing/);
    } finally {
      await model.close();
    }
  });
});

// ── 10. Hospital: init says where the text goes ─────────────────────────────
describe('Round 10 — hospital: init says when the default sends the strings to a hosted service, and how to keep them here', () => {
  it('10a: llm (the default) names OpenRouter and the local alternative; local and a loopback api endpoint say nothing; a remote endpoint is named', async () => {
    const flutter = () => {
      const d = tmp('flutter');
      write(path.join(d, 'pubspec.yaml'), 'name: ward\nflutter:\n  generate: true\n');
      writeJSON(path.join(d, 'lib/l10n/app_en.arb'), { '@@locale': 'en', dose: 'One dose' });
      return d;
    };
    const hosted = await runCli(['init', '--yes', '--langs', 'qaa', '--name', 'qaa=Ayta'], flutter(), NO_CI);
    assert.equal(hosted.code, 0, hosted.out);
    assert.match(hosted.out, /Where the text goes: llm sends every string it translates to OpenRouter, a hosted service, which passes them to the model's provider\./);
    assert.match(hosted.out, /To keep it on this machine, use a model served here \(Ollama, LM Studio, vLLM\): "defaultMethod": "local" and\n\s+"model": "<its name>" in the config — or try it for one run: champollion sync --method local --model <its name>\./);
    const local = await runCli(['init', '--yes', '--langs', 'qaa', '--method', 'local', '--model', 'ward-mt'], flutter(), NO_CI);
    assert.doesNotMatch(local.out, /Where the text goes/);
    const loop = await runCli(['init', '--yes', '--langs', 'qaa', '--method', 'api', '--endpoint', 'http://127.0.0.1:8378/translate', '--accepts-instructions', 'false'], flutter(), NO_CI);
    assert.equal(loop.code, 0, loop.out);
    assert.doesNotMatch(loop.out, /Where the text goes/);
    const remote = await runCli(['init', '--yes', '--langs', 'qaa', '--method', 'api', '--endpoint', 'https://mt.example.org/translate', '--accepts-instructions', 'false'], flutter(), NO_CI);
    assert.match(remote.out, /Where the text goes: api sends every string it translates to the server at https:\/\/mt\.example\.org\/translate\./);
    const deepl = await runCli(['init', '--yes', '--langs', 'fr', '--method', 'deepl'], flutter(), NO_CI);
    assert.match(deepl.out, /Where the text goes: deepl sends every string it translates to DeepL's hosted API\./);
  });
});

// ══════════════════════════════════════════════════════════════════════════
/**
 * Round 10 synthetic personas, lane A — register-corpus and language pairs.
 *
 *   12. Registering a test set someone may train a model against prints the
 *       nmt-forge steps (register, screen, predict) BEFORE the baseline: a
 *       benchmark is a scoring read, and forge refuses predictions written
 *       after one (Cree-school persona).
 *   16. Help, wizard and printed lines say what happens to the file: it is
 *       read on this machine only (to count and checksum it, or to encrypt
 *       it); nothing is uploaded. `--help` said "never reads".
 *   17. One pair notation. Every command that takes a language pair reads
 *       eng>crk, eng-crk and eng:crk; the network commands print eng>crk.
 *
 * End to end through the real CLI (bin/cli.js). No network: the leaderboard
 * reads a loopback stand-in for its REST table, everything else runs offline.
 */
{
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-round10a-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const tmp = (prefix) => fs.mkdtempSync(path.join(ROOT, `${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, obj) => write(file, JSON.stringify(obj, null, 2));
const OFFLINE = { CHAMPOLLION_OFFLINE: '1', CI: '', GITHUB_ACTIONS: '' };
const TSV = 'The library opens at nine.\tsynthetic-one\nBring your boots tomorrow.\tsynthetic-two\nWe eat lunch at noon.\tsynthetic-three\n';
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** A project with a test file; `register` runs the persona's command on it. */
function school() {
  const d = tmp('school');
  write(path.join(d, 'data/test.tsv'), TSV);
  return d;
}
const register = (d, extra = [], env = {}) => runCli(['network', 'register-corpus', '--yes', '--name', 'Teacher checked',
  '--pair', 'eng-crk', '--license', 'community-eval-grant-nc', '--domain', 'educational', '--data', 'data/test.tsv',
  '--contamination', 'none', '--cards-dir', 'cards-out', ...extra], d, { ...OFFLINE, ...env });

/** A forge project the way `nmt-forge init` lays one out (.forge/ + config.json). */
function forgeProject(d, dir, { sets = {}, preregs = [] } = {}) {
  writeJSON(path.join(d, dir, 'config.json'), { run_name: 'x', workspace: '.forge', language: { source: 'eng', target: 'crk' } });
  writeJSON(path.join(d, dir, '.forge', 'eval-registry.json'), { version: 1, sets });
  fs.mkdirSync(path.join(d, dir, '.forge', 'preregistrations'), { recursive: true });
  for (const pr of preregs) writeJSON(path.join(d, dir, '.forge', 'preregistrations', `${pr.id}.json`), pr);
}

const at = (out, s) => {
  const i = out.indexOf(s);
  assert.ok(i >= 0, `missing: ${s}\n---\n${out}`);
  return i;
};

// ── 12. The forge steps come before the first score ──────────────────────────
describe('Round 10 — 12: a test set a model may be trained against: nmt-forge first, then the baseline', () => {
  it('local-only --role test (the school\'s command): init, registry add, leak-audit, prereg — then mt-eval run', async () => {
    const d = school();
    const r = await register(d, ['--tier', 'local-only', '--role', 'test', '--out', 'data']);
    assert.equal(r.code, 0, r.out);
    const out = r.stdout;
    const steps = [
      'Training a model for eng>crk? Do this first, before anything scores this file.',
      'A benchmark is a scoring read, and nmt-forge refuses predictions written after one:',
      '    nmt-forge init crk --dir crk-model   # once: the training project (any folder name)\n',
      '    cd crk-model\n',
      '    nmt-forge registry add project-test ../data/test.tsv --role test\n',
      '    nmt-forge leak-audit <training corpus> --clean-to corpus.clean.jsonl\n',
      '    nmt-forge prereg template --out predictions.json',
      '    nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json\n',
      '    cd ..\n',
      'Then measure a local model on it (the baseline) — or now, if no model will',
      '    mt-eval run --corpus data/test.tsv --provider local',
    ];
    let last = -1;
    for (const s of steps) {
      const i = at(out, s);
      assert.ok(i > last, `out of order: ${s}`);
      last = i;
    }
    assert.doesNotMatch(out, /Next: measure a local model/, 'the baseline is not offered as the next step');
  });

  it('private, no role stated: the forge steps come before "evaluate on it"', async () => {
    const d = school();
    const r = await register(d, ['--tier', 'private']);
    assert.equal(r.code, 0, r.out);
    assert.ok(at(r.stdout, 'nmt-forge registry add project-test ../data/test.tsv --role test')
      < at(r.stdout, 'Then evaluate on it (the baseline) — or now, if no model will be trained'));
    assert.ok(at(r.stdout, 'Then evaluate on it') < at(r.stdout, 'mt-eval run --corpus data/test.tsv --provider <provider>'));
    assert.match(r.stdout, /Your text was read on this machine only to count and checksum it\./);
  });

  it('a dev set (nobody\'s predictions are judged on it) keeps the plain baseline advice', async () => {
    const d = school();
    const r = await register(d, ['--tier', 'local-only', '--role', 'dev', '--out', 'data']);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.stdout, /nmt-forge/);
    assert.match(r.stdout, /Next: measure a local model on it:\n {4}mt-eval run --corpus data\/test\.tsv/);
  });

  it('an existing forge project for the pair is used — no second init, paths written from inside it', async () => {
    const d = school();
    forgeProject(d, 'school-crk');
    const r = await register(d, ['--tier', 'local-only', '--role', 'test', '--out', 'data']);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.stdout, /nmt-forge init/);
    assert.ok(at(r.stdout, '    cd school-crk\n') < at(r.stdout, 'nmt-forge registry add project-test ../data/test.tsv --role test'));
  });

  it('a file forge already holds keeps its name; project-test taken by another file is not reused; prereg ids and files are free ones', async () => {
    const d = school();
    forgeProject(d, 'school-crk', {
      sets: { 'project-test': { sha256: 'f'.repeat(64), role: 'test', rows: 9 } },
      preregs: [{ id: 'all-data', eval_set: { name: 'project-test', sha256: 'f'.repeat(64) } }],
    });
    write(path.join(d, 'school-crk', 'predictions.json'), '[]');
    const r = await register(d, ['--tier', 'local-only', '--role', 'test', '--out', 'data']);
    assert.equal(r.code, 0, r.out);
    const id = 'eval-eng-crk-teacher-checked-test-v1';
    assert.match(r.stdout, new RegExp(`nmt-forge registry add ${id} \\.\\./data/test\\.tsv --role test\\n`));
    assert.match(r.stdout, /nmt-forge prereg template --out predictions-all-data-2\.json/);
    assert.match(r.stdout, new RegExp(`nmt-forge prereg new all-data-2 --eval-set ${id} --predictions predictions-all-data-2\\.json\\n`));
  });

  it('a file already registered and preregistered with forge: says so, and the baseline is next', async () => {
    const d = school();
    const sha = sha256(path.join(d, 'data/test.tsv'));
    forgeProject(d, 'school-crk', {
      sets: { 'project-test': { sha256: sha, role: 'test', rows: 3 } },
      preregs: [{ id: 'all-data', eval_set: { name: 'project-test', sha256: sha } }, { id: 'notwins', eval_set: { name: 'project-test', sha256: sha } }],
    });
    const r = await register(d, ['--tier', 'local-only', '--role', 'test', '--out', 'data']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.stdout, /nmt-forge already holds this file \(as project-test, in school-crk\) with predictions written\n {2}down before any score \(all-data, notwins\)\./);
    assert.doesNotMatch(r.stdout, /nmt-forge registry add|prereg new/);
    assert.match(r.stdout, /Next: measure a local model on it:/);
  });

  it('a private-use code (no language card): forge init gets --no-card and the project\'s name for it', async () => {
    const d = school();
    writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'messages', languages: { qaa: { name: 'Ayta (variety not yet confirmed)' } } });
    const r = await runCli(['network', 'register-corpus', '--yes', '--name', 'Ward phrases', '--pair', 'eng-qaa', '--role', 'test',
      '--tier', 'local-only', '--license', 'proprietary', '--domain', 'medical', '--data', 'data/test.tsv', '--out', 'data', '--contamination', 'none'], d, OFFLINE);
    assert.equal(r.code, 0, r.out);
    assert.match(r.stdout, /nmt-forge init qaa --dir qaa-model --no-card --name 'Ayta \(variety not yet confirmed\)'/);
  });
});

// ── 16. What happens to the file, said the same way everywhere ───────────────
describe('Round 10 — 16: help, catalogue and the run say the file is read here, never sent', () => {
  it('`register-corpus --help` no longer says "never reads"; it says what is read, where, and why', async () => {
    const d = tmp('help');
    const r = await runCli(['network', 'register-corpus', '--help'], d, OFFLINE);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.stdout, /never read/i);
    assert.match(r.stdout, /never uploads or hosts your corpus text, in any tier\. A file you\s+name is read on this machine only: --data to count its entries and checksum\s+it, --seal-input to encrypt it\. None of it is sent anywhere\./);
    assert.match(r.stdout, /--data <file> +The local test-set file \(TSV\/JSONL\/JSON\): read on this machine only to count and checksum it, never uploaded/);
    assert.match(r.stdout, /four exposure\s+tiers/);
    const list = await runCli(['network', 'register-corpus', '--list'], d, OFFLINE);
    assert.match(list.stdout, /file is read on this machine only to count and checksum it; none of it leaves/);
  });

  it('the command module prints the same help as `--help` (one text, not two that drift)', async () => {
    const d = tmp('help-one');
    const viaCli = (await runCli(['network', 'register-corpus', '--help'], d, OFFLINE)).stdout;
    const { run } = await import('../lib/commands/register-corpus.js');
    const lines = [];
    const orig = console.log;
    console.log = (...a) => lines.push(a.join(' '));
    try { assert.equal(await run({ _: ['register-corpus'], help: true }, d), 0); } finally { console.log = orig; }
    assert.equal(lines.join('\n') + '\n', viaCli);
  });

  it('no lib file claims the corpus text is never read', () => {
    const LIB = new URL('../lib/', import.meta.url);
    const files = ['commands/register-corpus.js', 'command-help.js', 'seal.mjs', 'corpus-registration.mjs'];
    for (const f of files) {
      const src = fs.readFileSync(new URL(f, LIB), 'utf8');
      assert.doesNotMatch(src, /never reads?,? (?:upload|or host|your|the) /i, f);
      assert.doesNotMatch(src, /We NEVER read/, f);
    }
  });
});

// ── 17. One pair notation ────────────────────────────────────────────────────
describe('Round 10 — 17: the pair reader (lib/language-pair.js)', () => {
  it('reads every accepted spelling the same way', () => {
    for (const v of ['eng>crk', 'eng-crk', 'eng:crk', 'eng→crk', 'eng->crk', 'eng,crk', 'eng crk', ' eng > crk ', 'eng - crk']) {
      const p = parseLanguagePair(v);
      assert.equal(p.ok, true, v);
      assert.equal(formatLanguagePair(p), 'eng>crk', v);
    }
  });

  it('a code with its own hyphen needs an explicit separator; the dash form is never guessed', () => {
    assert.deepEqual(parseLanguagePair('en>pt-BR'), { ok: true, source: 'en', target: 'pt-BR' });
    assert.deepEqual(parseLanguagePair('sr-Latn:en'), { ok: true, source: 'sr-Latn', target: 'en' });
    assert.deepEqual(parseLanguagePair('en->pt-BR'), { ok: true, source: 'en', target: 'pt-BR' });
    const amb = parseLanguagePair('en-pt-BR');
    assert.equal(amb.ok, false);
    assert.match(amb.error, /can be read more than one way \("en>pt-BR" or "en-pt>BR"\)/);
  });

  it('the dash form is two bare 2–3 letter codes: crk-Cans is one code with a subtag, not crk → Cans', () => {
    assert.deepEqual(parseLanguagePair('qaa-eng'), { ok: true, source: 'qaa', target: 'eng' });
    for (const v of ['crk-Cans', 'ace_Arab-eng', 'abcd-eng']) {
      const p = parseLanguagePair(v);
      assert.equal(p.ok, false, v);
      assert.match(p.error, /is not read as a pair: with a hyphen, a pair is two language codes of two or three letters/, v);
    }
    assert.deepEqual(parseLanguagePair('eng>crk-Cans'), { ok: true, source: 'eng', target: 'crk-Cans' });
  });

  it('reads a pair the way the harness does (arena/mt_eval_harness/pair_notation.py) for every form both accept', (t) => {
    const file = fileURLToPath(new URL('../../arena/mt_eval_harness/pair_notation.py', import.meta.url));
    if (!fs.existsSync(file)) return t.skip('no harness checkout beside the CLI');
    const cases = ['eng>crk', 'eng-crk', 'eng→crk', 'eng->crk', ' eng > crk ', 'en>pt-BR', 'eng>crk-Cans', 'qaa-eng',
      'crk-Cans', 'en-pt-BR', 'ace_Arab-eng', 'eng', 'eng>', '>crk', 'eng>crk>fra'];
    const script = 'import importlib.util,json,sys\n'
      + `s=importlib.util.spec_from_file_location("pn", ${JSON.stringify(file)}); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)\n`
      + 'out={}\n'
      + `for c in ${JSON.stringify(cases)}:\n`
      + '    try: out[c]=list(m.parse_pair(c))\n'
      + '    except m.PairNotationError: out[c]=None\n'
      + 'print(json.dumps(out))\n';
    const r = spawnSync('python3', ['-c', script], { encoding: 'utf8' });
    if (r.error && r.error.code === 'ENOENT') return t.skip('python3 not available');
    assert.equal(r.status, 0, r.stderr);
    const py = JSON.parse(r.stdout);
    for (const c of cases) {
      const js = parseLanguagePair(c);
      assert.deepEqual(js.ok ? [js.source, js.target] : null, py[c], `CLI and harness disagree on ${JSON.stringify(c)}`);
    }
  });

  it('refuses what is not a pair, and says why', () => {
    assert.match(parseLanguagePair('eng', { label: '--pair' }).error, /--pair eng names one language; a pair names two, source first: "eng>crk" or eng-crk\. If you typed eng>… without quotes, the shell read the > as "send the output to a file"/);
    assert.match(parseLanguagePair('eng>').error, /names no target language/);
    assert.match(parseLanguagePair('>crk').error, /names no source language/);
    assert.match(parseLanguagePair('eng>crk>fra').error, /more than one ">"/);
    assert.match(parseLanguagePair('e!g>crk').error, /"e!g" is not a language code/);
    assert.equal(parseLanguagePair(true).ok, false);
  });
});

describe('Round 10 — 17: register-corpus reads every spelling and prints eng>crk', () => {
  const reg = (d, pair) => runCli(['network', 'register-corpus', '--yes', '--name', `Set ${pair}`, '--pair', pair,
    '--license', 'cc-by-4.0', '--size', '3', '--domain', 'news', '--out', 'out'], d, OFFLINE);
  const card = (d, id) => readJSON(path.join(d, 'out', `${id}.json`));

  it('eng:crk (refused before) and eng-crk register the same pair; the summary prints eng>crk', async () => {
    const d = tmp('pairs');
    const colon = await reg(d, 'eng:crk');
    assert.equal(colon.code, 0, colon.out);
    assert.match(colon.stdout, /Pair: {9}eng>crk\n/);
    assert.deepEqual(card(d, 'eval-eng-crk-set-eng-crk-v1').pair, { source: 'eng', target: 'crk', direction: 'unidirectional' });
  });

  it('"eng>pt-BR" keeps the region (it was silently registered as eng→pt); en-pt-BR is refused with both readings', async () => {
    const d = tmp('pairs-subtag');
    const ok = await reg(d, 'eng>pt-BR');
    assert.equal(ok.code, 0, ok.out);
    assert.match(ok.stdout, /Pair: {9}eng>pt-br\n/);
    assert.equal(card(d, 'eval-eng-pt-br-set-eng-pt-br-v1').pair.target, 'pt-br');
    const amb = await reg(d, 'en-pt-BR');
    assert.equal(amb.code, 1);
    assert.match(amb.stderr, /--pair en-pt-BR has 2 hyphens, so it can be read more than one way \("en>pt-BR" or "en-pt>BR"\)/);
  });

  it('a single code (an unquoted > ate the rest) is named as such — not "a source code is required"', async () => {
    const d = tmp('pairs-one');
    const r = await reg(d, 'eng');
    assert.equal(r.code, 1);
    assert.match(r.stderr, /--pair eng names one language; a pair names two/);
    assert.match(r.stderr, /without quotes, the shell read the > as "send the output to a file"/);
    assert.doesNotMatch(r.stderr, /A source language code is required/);
  });
});

/** A stand-in for the leaderboard's REST table (run_cards), filtered like PostgREST's eq. */
async function startBoard(rows) {
  const seen = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    seen.push(url);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const eq = url.searchParams.get('language_pair');
    res.end(JSON.stringify(eq ? rows.filter(r => `eq.${r.language_pair}` === eq) : rows));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, seen, close: () => new Promise(r => server.close(r)) };
}

describe('Round 10 — 17: leaderboard --pair finds the board\'s eng>crk rows from any spelling', () => {
  const ROW = { model_slug: 'stub-model', condition: 'naive', language_pair: 'eng>crk', composite_score: 0.4, chrf_plus_plus: 21.5,
    run_timestamp: '2026-10-01T00:00:00Z', quality_tier: 'emerging', run_card: { contamination: 'LOW' } };

  it('eng-crk, "eng>crk", eng:crk and en-crk all filter on eng>crk (eng-crk used to match nothing)', async () => {
    const board = await startBoard([ROW, { ...ROW, model_slug: 'other', language_pair: 'eng>fra' }]);
    try {
      const d = tmp('board');
      for (const p of ['eng-crk', 'eng>crk', 'eng:crk', 'en-crk']) {
        const r = await runCli(['network', 'leaderboard', '--pair', p, '--json'], d, { ...OFFLINE, CHAMPOLLION_SUPABASE_URL: board.url });
        assert.equal(r.code, 0, r.out);
        const rows = r.stdout.trim().split('\n').map(l => JSON.parse(l));
        assert.deepEqual(rows.map(x => [x.model, x.pair]), [['stub-model', 'eng>crk']], p);
        assert.equal(board.seen.at(-1).searchParams.get('language_pair'), 'eq.eng>crk', p);
      }
      const human = await runCli(['network', 'leaderboard', '--pair', 'en-crk'], d, { ...OFFLINE, CHAMPOLLION_SUPABASE_URL: board.url });
      assert.match(human.stdout, /English → Plains Cree \(eng>crk\) {2}\| {2}Sorted by: chrF\+\+/);
      assert.match(human.stdout, /\(codes resolved to ISO 639-3: en → eng\)/);
    } finally {
      await board.close();
    }
  });

  it('a pair it cannot read is refused before any request', async () => {
    const board = await startBoard([ROW]);
    try {
      const d = tmp('board-bad');
      const r = await runCli(['network', 'leaderboard', '--pair', 'eng'], d, { ...OFFLINE, CHAMPOLLION_SUPABASE_URL: board.url });
      assert.equal(r.code, 1);
      assert.match(r.stderr, /--pair eng names one language/);
      assert.equal(board.seen.length, 0, 'nothing was fetched');
    } finally {
      await board.close();
    }
  });
});

describe('Round 10 — 17: recommend takes the pair as two codes or as one value', () => {
  it('eng crk, eng-crk, "eng>crk" and --pair eng:crk give the same pair', async () => {
    const d = tmp('recommend');
    for (const args of [['eng', 'crk'], ['eng-crk'], ['eng>crk'], ['--pair', 'eng:crk']]) {
      const r = await runCli(['network', 'recommend', ...args, '--json'], d, OFFLINE);
      assert.equal(r.code, 0, `${args.join(' ')}: ${r.out}`);
      assert.deepEqual(JSON.parse(r.stdout).pair, { source: 'eng', target: 'crk' }, args.join(' '));
    }
  });

  it('one code, or the pair given twice, is refused with the reason', async () => {
    const d = tmp('recommend-bad');
    const one = await runCli(['network', 'recommend', 'eng'], d, OFFLINE);
    assert.equal(one.code, 1);
    assert.match(one.stderr, /recommend eng names one language/);
    const twice = await runCli(['network', 'recommend', 'eng', 'crk', '--pair', 'eng-crk'], d, OFFLINE);
    assert.equal(twice.code, 1);
    assert.match(twice.stderr, /Give the pair once: --pair eng-crk or eng crk, not both\./);
  });
});

describe('Round 10 — 17: submit — one label for every pairs field; the issue carries eng>crk', () => {
  it('the three pairs fields share one label (they said eng-crk in one, source→target in two)', () => {
    const labels = SUBMISSION_TYPES.flatMap(t => t.fields.filter(f => f.id === 'pairs').map(f => f.label));
    assert.equal(labels.length, 3);
    assert.ok(labels.every(l => l === PAIRS_LABEL));
  });

  it('pairs are read in any spelling and written source>target; a line that is not a pair fails loud', () => {
    assert.deepEqual(readPairLines('eng-crk\n\nen>pt-BR\r\neng:fra'), { pairs: ['eng>crk', 'en>pt-BR', 'eng>fra'], errors: [] });
    const type = resolveType('dataset');
    const values = { 'dataset-name': 'X', pairs: 'eng-crk\nEnglish to Cree', license: 'CC-BY-4.0', 'source-url': 'https://x', attestation: true };
    const v = validateSubmission(type, values);
    assert.equal(v.ok, false);
    assert.match(v.errors.join('\n'), /pairs: line 2: English to Cree is more than two codes/);
    assert.equal(normalizeSubmissionValues(type, { ...values, pairs: 'eng-crk' }).pairs, 'eng>crk');
  });

  it('end to end: --field pairs=eng-crk goes into the issue URL as eng>crk; a bad pair exits 1 without the attestation footer', async () => {
    const d = tmp('submit');
    const ok = await runCli(['network', 'submit', '--yes', '--json', '--type', 'dataset', '--attest',
      '--field', 'dataset-name=Teacher set', '--field', 'pairs=eng-crk', '--field', 'license=CC-BY-4.0', '--field', 'source-url=https://example.org'], d, OFFLINE);
    assert.equal(ok.code, 0, ok.out);
    assert.equal(new URL(JSON.parse(ok.stdout).issueUrl).searchParams.get('pairs'), 'eng>crk');
    const bad = await runCli(['network', 'submit', '--yes', '--json', '--type', 'dataset', '--attest',
      '--field', 'dataset-name=Teacher set', '--field', 'pairs=eng', '--field', 'license=CC-BY-4.0', '--field', 'source-url=https://example.org'], d, OFFLINE);
    assert.equal(bad.code, 1);
    assert.match(bad.stderr, /pairs: line 1: eng names one language/);
    assert.doesNotMatch(bad.stderr, /attestation is required/);
  });
});

describe('Round 10 — 17: project pairs (sync/verify/serve --pair) already read all three spellings', () => {
  it('verify --pair en:fr, en>fr and en-fr check fr only; en-pt-BR resolves against the configured pair', async () => {
    const d = tmp('project');
    writeJSON(path.join(d, 'messages/en.json'), { greet: 'Hello there, my friend' });
    writeJSON(path.join(d, 'messages/fr.json'), { greet: 'Bonjour, mon ami' });
    writeJSON(path.join(d, 'messages/pt-BR.json'), {});
    writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'messages', languages: ['fr', 'pt-BR'], defaultMethod: 'local', model: 'm1' });
    for (const p of ['en:fr', 'en>fr', 'en-fr']) {
      const r = await runCli(['verify', '--pair', p], d, OFFLINE);
      assert.equal(r.code, 0, `${p}: ${r.out}`);
      assert.doesNotMatch(r.out, /pt-BR/, p);
    }
    const br = await runCli(['verify', '--pair', 'en-pt-BR'], d, OFFLINE);
    assert.equal(br.code, 1, br.out);
    assert.match(br.out, /\[VERIFY\] pt-BR: 1 missing key\(s\): greet/);
  });
});

describe('Round 10 — 17: the help says how to write a pair', () => {
  it('register-corpus --pair carries the reader\'s own notation text; network, leaderboard, recommend and submit name both forms', () => {
    const opt = (cmd, flag) => COMMAND_HELP[cmd].options.find(([f]) => f.startsWith(flag))?.[1] || '';
    assert.ok(opt('register-corpus', '--pair').includes(PAIR_NOTATION_HELP), 'help text and lib/language-pair.js agree');
    assert.match(COMMAND_HELP.network.description.join(' '), /A language pair is written source>target: "eng>crk".*also read eng-crk\s+and eng:crk/);
    assert.match(opt('leaderboard', '--pair'), /"eng>crk".*eng-crk and eng:crk work too/);
    assert.match(opt('recommend', '--pair'), /"eng>yor".*eng-yor or eng:yor/);
    assert.match(COMMAND_HELP.submit.description.join(' '), /one language pair per line, source>target/);
  });
});
}

// ══════════════════════════════════════════════════════════════════════════
/**
 * Round 10, the Cree school persona (lane B): a fallback's coaching is part of
 * what it is, and sync refuses at write time what verify would flag.
 *
 *   13. A coaching file set on the pair's FALLBACK reached neither its prompt
 *       (a plain LLM method reads the resolved text only) nor its cache key,
 *       so `sync --redo all` served the uncoached text; `status` did not show
 *       it. Now it is read, keyed, announced with its redo and price, shown.
 *   14. The newsletter's title got the memorized sentence the gate had just
 *       refused for three app strings — refused members were never in the
 *       index — and only `verify` caught it. Also: the index now starts with
 *       what the locale's files and pages hold (verify's scope).
 *
 * End to end through the real CLI (bin/cli.js): the pair's method is a stub
 * champollion `api` endpoint (the persona's trained model, which takes no
 * instructions), its fallback the fake OpenAI-compatible model
 * (test/fixtures/fake-openai-model.mjs, method `local`). No network beyond
 * 127.0.0.1, no key.
 */
{
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-round10b-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const tmp = (prefix) => fs.mkdtempSync(path.join(ROOT, `${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const readJSON = (file) => JSON.parse(read(file));
const writeJSON = (file, obj) => write(file, JSON.stringify(obj, null, 2));
const NO_CI = { CI: '', GITHUB_ACTIONS: '' };

/** The persona's model: one memorized sentence for several app strings. */
const MEM = 'Mani nasisa kaka mamama kimika sisisa mamama sani mamama.';
/** A sentence the model gives once, for one source (accepted on its own). */
const ONCE = 'Siyo kayo mamama kope sisisa mamama sani mamama towape.';

/** A stub champollion `api` endpoint answering from `answers` (source → text). */
async function startApi(answers) {
  const asked = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const { keys = {} } = JSON.parse(body || '{}');
      asked.push(...Object.values(keys));
      const translations = {};
      for (const [k, v] of Object.entries(keys)) translations[k] = answers[v] ?? `Rud ${v.length} kenik zolas`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ translations }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}/translate`, asked, close: () => new Promise((r) => server.close(r)) };
}

/** The fallback's pseudo-translation: word by word, placeholders kept. */
function pseudo(text) {
  const syl = ['ka', 'mi', 'to', 'su', 'pe', 'no', 'ri', 'la', 'zo', 'de'];
  return text.replace(/(?<![{\w])[A-Za-z]+(?![}\w])/g, (w) => {
    let h = 0;
    for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return syl[h % 10] + syl[(h >>> 4) % 10] + (w.length > 4 ? syl[(h >>> 8) % 10] : '');
  });
}

/** A Cree-school project: app strings, the `api` method, a `local` fallback. */
function school({ messages, fallback = {}, contentDir = false } = {}) {
  const d = tmp('school');
  writeJSON(path.join(d, 'app/messages/en.json'), messages || {
    Home: { title: 'Welcome, families', lunch: 'Lunch today: {menu}' },
    Forms: { submit: 'Send the form' },
    Nav: { contact: 'Contact the school' },
  });
  return { d, configure: (api) => writeJSON(path.join(d, 'champollion.config.json'), {
    version: 3,
    inputLocale: 'en',
    localesDir: './app/messages',
    languages: { crk: { script: 'Latn' } },
    defaultMethod: 'api',
    ...(contentDir ? { contentDir: 'newsletter' } : {}),
    pairs: {
      'en:crk': {
        method: 'api', endpoint: api.url, acceptsInstructions: false,
        fallback: { method: 'local', model: 'stub-1', ...fallback },
      },
    },
  }) };
}

const API_ANSWERS = {
  'Welcome, families': MEM,
  'Send the form': MEM,
  'Contact the school': MEM,
  'Lunch today: {menu}': 'Toho kayo mamama kasape sisisa mamama sani. {menu}',
};
const fallbackCalls = (model) => model.calls.filter((c) => c.model === 'stub-1');

describe('Round 10 (13) — a fallback\'s coaching is read, keyed, announced and shown', () => {
  it('a coachingFile added to the fallback: announced with its redo and price, shown by status, and --redo all asks the fallback again WITH the coaching', async () => {
    const api = await startApi(API_ANSWERS);
    const model = await startFakeModel((k, s) => pseudo(s));
    try {
      const { d, configure } = school();
      configure(api);
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      const first = await runCli(['sync'], d, env);
      assert.equal(first.code, 0, first.out);
      assert.ok(fallbackCalls(model).length > 0, 'the fallback translated what the endpoint repeated');
      assert.ok(fallbackCalls(model).every((c) => !/Coaching guidance/.test(c.system)), 'no coaching yet');

      // The persona's edit: a coaching file on the FALLBACK. The cache is also
      // made to look as if an older version wrote it (no "coachingKeyed"
      // mark): the fallback's old entries were made WITHOUT that coaching —
      // the old version never read a fallback's own file — so they must not
      // be taken for coached ones.
      write(path.join(d, 'coaching.txt'), 'Write as the school writes: short, plain sentences for families.');
      const cfg = readJSON(path.join(d, 'champollion.config.json'));
      cfg.pairs['en:crk'].fallback.coachingFile = 'coaching.txt';
      writeJSON(path.join(d, 'champollion.config.json'), cfg);
      const tmFile = path.join(d, '.champollion/tm.json');
      const tm = readJSON(tmFile);
      delete tm._meta.coachingKeyed;
      writeJSON(tmFile, tm);

      // A plain sync changes nothing, and says why, with the redo and its price.
      const calls = model.calls.length;
      const plain = await runCli(['sync'], d, env);
      assert.equal(plain.code, 0, plain.out);
      assert.equal(model.calls.length, calls, 'nothing sent');
      assert.match(plain.out, /en:crk: 3 translation\(s\) in the files were written by the fallback as it was set up before — local · model stub-1 · register \S+ \(3\) — not as it is now \(local · model stub-1 · register \S+ · coaching [0-9a-f]{8}\)\. Nothing changed: a change of the fallback's model, register or coaching re-translates nothing on its own\. To re-translate them: `champollion sync --pair en:crk --redo all` — sends up to 3 key\(s\) to api first, and what it refuses to the fallback \(api: .*; local: \$0 API cost \(runs on this machine\)\)\./);
      assert.doesNotMatch(plain.out, /To have api translate them/, 'not reported as another method of the pair');

      // status shows the fallback's coaching, and the values it wrote before.
      const status = await runCli(['status'], d, env);
      assert.equal(status.code, 0, status.out);
      assert.match(status.out, /fallback: local {2}\| {2}model: stub-1 .*\| {2}coaching: coaching\.txt \(cache key coaching [0-9a-f]{8}\)/);
      assert.match(status.out, /from the fallback as it was set up before: 3 value\(s\) \(Home\.title, Forms\.submit, Nav\.contact\) — written by local · model stub-1/);
      assert.doesNotMatch(status.out, /mixed:|earlier model:/, 'the fallback\'s values are not "another model" of the pair');
      const json = JSON.parse((await runCli(['status', '--json'], d, env)).stdout);
      const fb = json.pairs[0].fallback;
      assert.deepEqual({ file: fb.coaching.file, sent: fb.coaching.sent }, { file: 'coaching.txt', sent: true });
      assert.equal(fb.earlierSetup.values, 3);
      const config = resolveConfig({}, d);
      const fbKey = tmMethodKey(resolvePairs(config, { cwd: d }).get('en:crk').fallback);
      assert.equal(fbKey.split('|')[3], fb.coaching.fingerprint, 'the fingerprint status shows is the cache key\'s');

      // --redo all: the fallback is asked again, with the coaching in its prompt.
      const before = fallbackCalls(model).length;
      const redo = await runCli(['sync', '--redo', 'all'], d, env);
      assert.equal(redo.code, 0, redo.out);
      assert.doesNotMatch(redo.out, /served from the fallback's cache/);
      const asked = fallbackCalls(model).slice(before);
      assert.ok(asked.length > 0, `the fallback was asked again\n${redo.out}`);
      assert.ok(asked.every((c) => c.system.includes('Coaching guidance:\nWrite as the school writes: short, plain sentences for families.')), asked.map((c) => c.system).join('\n---\n'));
      assert.deepEqual(asked.flatMap((c) => c.keys).sort(), ['Forms.submit', 'Home.title', 'Nav.contact']);

      // An edit of the file is a change too: asked again with the new text.
      write(path.join(d, 'coaching.txt'), 'Use the spelling of the school\'s reader books.');
      const before2 = fallbackCalls(model).length;
      const again = await runCli(['sync', '--redo', 'all'], d, env);
      assert.equal(again.code, 0, again.out);
      const asked2 = fallbackCalls(model).slice(before2);
      assert.ok(asked2.length > 0 && asked2.every((c) => c.system.includes('Coaching guidance:\nUse the spelling of the school\'s reader books.')), again.out);
      // And once done, nothing is left to report.
      const quiet = await runCli(['sync'], d, env);
      assert.doesNotMatch(quiet.out, /set up before/);
      assert.doesNotMatch((await runCli(['status'], d, env)).out, /set up before/);
    } finally {
      await model.close();
      await api.close();
    }
  });

  it('a fallback\'s MODEL change: reused (model carry-over), and the note names the redo that re-asks it', async () => {
    const api = await startApi(API_ANSWERS);
    const model = await startFakeModel((k, s) => pseudo(s));
    try {
      const { d, configure } = school();
      configure(api);
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const cfg = readJSON(path.join(d, 'champollion.config.json'));
      cfg.pairs['en:crk'].fallback.model = 'stub-2';
      writeJSON(path.join(d, 'champollion.config.json'), cfg);
      const r = await runCli(['sync'], d, env);
      assert.match(r.out, /written by the fallback as it was set up before — local · model stub-1 .* not as it is now \(local · model stub-2 .*a model change alone reuses its earlier translations\)\. To re-translate them: `champollion sync --pair en:crk --redo all --fresh-on-model-change`/);
      const calls = model.calls.length;
      await runCli(['sync', '--redo', 'all', '--fresh-on-model-change'], d, env);
      assert.ok(model.calls.slice(calls).some((c) => c.model === 'stub-2'), 'the new model of the fallback was asked');
    } finally {
      await model.close();
      await api.close();
    }
  });

  it('a cache from before coaching was keyed: the same coaching is reused — no re-translation, no "another coaching" note', async () => {
    const model = await startFakeModel((k, s) => pseudo(s));
    try {
      const d = tmp('upgrade');
      writeJSON(path.join(d, 'messages/en.json'), { save: 'Save your changes', open: 'Open the settings page' });
      write(path.join(d, 'coach.txt'), 'Prefer short words.');
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'm1', languages: ['fr'], coachingFile: 'coach.txt',
      });
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      // Rewrite cache and lock as the version before 2026-10 left them: a
      // plain method's key had no coaching part (its prompt still carried it).
      const pc = resolvePairs(resolveConfig({}, d), { cwd: d }).get('en:fr');
      const now = tmMethodKey(pc);
      const old = now.replace(/\|[0-9a-f]{8}$/, '|');
      assert.notEqual(now, old, 'the coaching is in today\'s key');
      const tmFile = path.join(d, '.champollion/tm.json');
      const tm = readJSON(tmFile);
      delete tm._meta.coachingKeyed;
      for (const text of ['Save your changes', 'Open the settings page']) {
        const entry = tm[cacheKey(text, 'fr', now)];
        delete tm[cacheKey(text, 'fr', now)];
        tm[cacheKey(text, 'fr', old)] = { ...entry, m: old };
      }
      writeJSON(tmFile, tm);
      const lockFile = path.join(d, '.champollion.lock');
      const lock = readJSON(lockFile);
      lock.locales.fr.by = { [old]: lock.locales.fr.by[now] };
      writeJSON(lockFile, lock);

      const calls = model.calls.length;
      const r = await runCli(['sync', '--redo', 'all'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.equal(model.calls.length, calls, `served from the cache\n${r.out}`);
      assert.match(r.out, /0 key\(s\) sent to the model, 2 served from the cache/);
      assert.doesNotMatch(r.out, /written by/);
      assert.doesNotMatch((await runCli(['status'], d, env)).out, /mixed:|earlier model:/);
      // Recorded once: an edit of the coaching afterwards is a change.
      write(path.join(d, 'coach.txt'), 'Prefer very short words.');
      const edited = await runCli(['sync'], d, env);
      assert.match(edited.out, /2 translation\(s\) in the files were written by local · model m1 · register \S+ · coaching [0-9a-f]{8} \(2\), not by local · model m1 · register \S+ · coaching [0-9a-f]{8}/);
      await runCli(['sync', '--redo', 'all'], d, env);
      assert.ok(model.calls.length > calls && model.calls.at(-1).system.includes('Coaching guidance:\nPrefer very short words.'));
    } finally {
      await model.close();
    }
  });

  it('a language\'s own coachingFile reaches a plain method (and wins over the top-level text); a missing one stops the run, naming it', async () => {
    const model = await startFakeModel((k, s) => pseudo(s));
    try {
      const d = tmp('langcoach');
      writeJSON(path.join(d, 'messages/en.json'), { save: 'Save your changes' });
      write(path.join(d, 'coach.txt'), 'Top-level coaching.');
      write(path.join(d, 'fr-coach.txt'), 'French coaching: use the vous form.');
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'm1', coachingFile: 'coach.txt',
        languages: { fr: { coachingFile: 'fr-coach.txt' } },
      });
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      assert.match(model.calls.at(-1).system, /Coaching guidance:\nFrench coaching: use the vous form\./);
      assert.doesNotMatch(model.calls.at(-1).system, /Top-level coaching/);
      assert.match((await runCli(['status'], d, env)).out, /coaching: fr-coach\.txt \(cache key coaching [0-9a-f]{8}\)/);

      writeJSON(path.join(d, 'champollion.config.json'), {
        ...readJSON(path.join(d, 'champollion.config.json')), languages: { fr: { coachingFile: 'nope.txt' } },
      });
      const missing = await runCli(['sync'], d, env);
      assert.notEqual(missing.code, 0);
      assert.match(missing.out, /en:fr: languages\.fr: "coachingFile" "nope\.txt" cannot be read \(ENOENT/);
    } finally {
      await model.close();
    }
  });
});

describe('Round 10 (14) — sync refuses at write time what verify flags', () => {
  it('the first sync: the title that repeats the sentence just refused for three app strings is refused too, and filled by the fallback', async () => {
    const api = await startApi({ ...API_ANSWERS, 'October newsletter': MEM });
    const model = await startFakeModel((k, s) => pseudo(s));
    try {
      const { d, configure } = school({ contentDir: true });
      write(path.join(d, 'newsletter/2026-10.md'), '---\ntitle: October newsletter\n---\n\nThe students read the stories at the library.\n');
      configure(api);
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      const r = await runCli(['sync'], d, env);
      assert.doesNotMatch(r.out, /already written/, r.out);
      const page = read(path.join(d, 'newsletter/2026-10.crk.md'));
      assert.ok(!page.includes(MEM), page);
      assert.match(page, new RegExp(`title: "?${pseudo('October newsletter')}"?`), 'the fallback filled the title');
      assert.equal(r.code, 0, r.out);
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 0, v.out);
      assert.doesNotMatch(v.out, /same text for different source strings|caught the model repeating/);
    } finally {
      await model.close();
      await api.close();
    }
  });

  it('an app with nothing to translate still counts: a new page paragraph that repeats an app string\'s sentence is refused', async () => {
    const api = await startApi({ 'Welcome, families': ONCE, 'The elders visit the class tomorrow.': ONCE });
    const model = await startFakeModel((k, s) => pseudo(s));
    try {
      const { d, configure } = school({ messages: { Home: { title: 'Welcome, families' } } });
      configure(api);
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      assert.equal(readJSON(path.join(d, 'app/messages/crk.json')).Home.title, ONCE, 'one source: accepted');
      // A newsletter arrives; the app file has nothing to translate.
      write(path.join(d, 'newsletter/2026-10.md'), '# October\n\nThe elders visit the class tomorrow.\n');
      const cfg = readJSON(path.join(d, 'champollion.config.json'));
      writeJSON(path.join(d, 'champollion.config.json'), { ...cfg, contentDir: 'newsletter' });
      const r = await runCli(['sync'], d, env);
      const page = read(path.join(d, 'newsletter/2026-10.crk.md'));
      assert.ok(!page.includes(ONCE), `the paragraph is not the app's sentence\n${page}\n${r.out}`);
      assert.match(page, new RegExp(pseudo('The elders visit the class tomorrow.').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      const v = await runCli(['verify'], d, env);
      assert.doesNotMatch(v.out, /same text for different source strings/, v.out);
    } finally {
      await model.close();
      await api.close();
    }
  });

  it('an unchanged newsletter still counts: a new app string answered with a page\'s sentence is refused, and the fallback fills it', async () => {
    const api = await startApi({ 'The elders visit the class tomorrow.': ONCE, 'Welcome, families': 'Natisim fetanafa.', 'Contact the school': ONCE });
    const model = await startFakeModel((k, s) => pseudo(s));
    try {
      const { d, configure } = school({ messages: { Home: { title: 'Welcome, families' } }, contentDir: true });
      write(path.join(d, 'newsletter/2026-10.md'), '# October\n\nThe elders visit the class tomorrow.\n');
      configure(api);
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      assert.ok(read(path.join(d, 'newsletter/2026-10.crk.md')).includes(ONCE), 'one source: accepted');
      writeJSON(path.join(d, 'app/messages/en.json'), { Home: { title: 'Welcome, families' }, Nav: { contact: 'Contact the school' } });
      const r = await runCli(['sync'], d, env);
      const crk = readJSON(path.join(d, 'app/messages/crk.json'));
      assert.notEqual(crk.Nav.contact, ONCE, r.out);
      assert.equal(crk.Nav.contact, pseudo('Contact the school'), 'filled by the fallback');
      assert.match(r.out, /Nav\.contact: same output for 2 different source strings \("The elders visit the class tomorrow\.", "Contact the school"\)/);
      const v = await runCli(['verify'], d, env);
      assert.doesNotMatch(v.out, /same text for different source strings/, v.out);
    } finally {
      await model.close();
      await api.close();
    }
  });
});
}
