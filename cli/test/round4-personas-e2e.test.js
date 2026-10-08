/**
 * Round 4 synthetic developers (Next.js next-intl, i18next folder-per-language,
 * Django gettext, and the Cree school with a forge-trained model behind the
 * `api` method), end to end through the real CLI (bin/cli.js) against a tiny
 * local OpenAI-compatible model (test/fixtures/fake-openai-model.mjs).
 *
 * The personas' stub model returns the English with accents added; the gate
 * refuses that as a disguised echo (correct, not a bug). Each describe below
 * pins one finding: what happens to the keys the gate refused (pending after
 * a redo, held back after a plain sync), hand edits under a bulk redo, out-of-
 * date translations, the gate's plural/markup/script holes, the CI guide.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), `r4-${prefix}-`));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const readJSON = (file) => JSON.parse(read(file));
const writeJSON = (file, obj) => write(file, JSON.stringify(obj, null, 2));
const lockOf = (d) => readJSON(path.join(d, '.champollion.lock'));
const accent = (s) => s.replace(/o/g, 'ó').replace(/a/g, 'á').replace(/e/g, 'é');
const keysSent = (model, from = 0) => model.calls.slice(from).flatMap(c => c.keys);

// ── A Next.js project: messages/{en,fr}.json, one locale ────────────────────
function nextProject({ model, keys = 6, method = 'local', modelName = 'stub-1', extra = {} } = {}) {
  const d = tmp('next');
  const src = {};
  for (let i = 0; i < keys; i++) src[`k${i}`] = `Hello number ${i} today friend`;
  writeJSON(path.join(d, 'messages/en.json'), src);
  const cfg = (patch = {}) => writeJSON(path.join(d, 'champollion.config.json'), {
    inputLocale: 'en', localesDir: 'messages', languages: ['fr'], defaultMethod: method, model: modelName, ...extra, ...patch,
  });
  cfg();
  return { d, src, cfg, env: { LOCAL_API_BASE: model.url } };
}

/** A model that translates (tagged with the model name) unless told to echo a key with accents. */
function switchModel() {
  const state = { refuse: new Set(), refuseFor: null };
  const p = startFakeModel((key, src, { model }) => (state.refuse.has(key) && (!state.refuseFor || state.refuseFor === model)
    ? accent(src)
    : `[${model}] Salut ${src.length} ${key}`));
  return p.then(m => Object.assign(m, { state }));
}

describe('Round 4 — a redo that could not finish is pending, retried once by the next plain sync', () => {
  it('model switch with refusals: pending in the lock, status lists them, the next sync asks the new model for exactly those, success clears them', async () => {
    const model = await switchModel();
    try {
      const { d, cfg, env } = nextProject({ model });
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      cfg({ model: 'stub-2' });
      model.state.refuse = new Set(['k1', 'k2', 'k3']);
      model.state.refuseFor = 'stub-2';
      const redo = await runCli(['sync', '--redo', 'all', '--fresh-on-model-change'], d, env);
      assert.equal(redo.code, 2, redo.out);
      // The message is true: they are recorded and retried once.
      assert.match(redo.out, /3 key\(s\) this redo could not finish are recorded as pending in \.champollion\.lock — the next plain `champollion sync` asks the model for them once more/);
      assert.deepEqual(Object.keys(lockOf(d).locales.fr.pending).sort(), ['k1', 'k2', 'k3']);
      assert.match((await runCli(['status'], d, env)).out,
        /pending: 3 key\(s\) an earlier `--redo all --fresh-on-model-change` could not finish \(k1, k2, k3\)/);
      // The old model's text is still on disk for them.
      assert.match(readJSON(path.join(d, 'messages/fr.json')).k1, /^\[stub-1\]/);

      model.state.refuse = new Set();
      const before = model.calls.length;
      const next = await runCli(['sync'], d, env);
      assert.equal(next.code, 0, next.out);
      assert.deepEqual(keysSent(model, before).sort(), ['k1', 'k2', 'k3'], 'exactly the pending keys, asked of the model');
      assert.ok(model.calls.slice(before).every(c => c.model === 'stub-2'));
      assert.match(next.out, /retrying 3 key\(s\) an earlier `--redo all --fresh-on-model-change` could not finish/);
      assert.match(readJSON(path.join(d, 'messages/fr.json')).k1, /^\[stub-2\]/);
      assert.equal(lockOf(d).locales.fr.pending, undefined, 'cleared on success');
      // The switch is complete: nothing pending, no mix of models, no notice.
      const status = (await runCli(['status'], d, env)).out;
      assert.doesNotMatch(status, /pending|mixed:|earlier model/);
      assert.doesNotMatch((await runCli(['sync', '--dry'], d, env)).out, /Model changed/);
    } finally {
      await model.close();
    }
  });

  it('a pending retry refused again is held back: not re-sent on every sync, and status says so', async () => {
    const model = await switchModel();
    try {
      const { d, cfg, env } = nextProject({ model, keys: 4 });
      await runCli(['sync'], d, env);
      cfg({ model: 'stub-2' });
      model.state.refuse = new Set(['k1']);
      model.state.refuseFor = 'stub-2';
      await runCli(['sync', '--redo', 'all', '--fresh-on-model-change'], d, env);
      let before = model.calls.length;
      const retry = await runCli(['sync'], d, env);
      assert.ok(keysSent(model, before).includes('k1'), 'the one promised retry');
      assert.match(retry.out, /1 key\(s\) are held back: the quality gate refused the method's translation of their current text/);
      before = model.calls.length;
      const again = await runCli(['sync'], d, env);
      assert.equal(again.code, 2, 'untranslated work is not a clean pass');
      assert.deepEqual(keysSent(model, before), [], 'not re-sent (not re-billed)');
      assert.match(again.out, /1 key\(s\) held back \(k1\)/);
      assert.match((await runCli(['status'], d, env)).out,
        /pending, held back: 1 key\(s\) a redo could not finish, refused again on the retry \(k1\) — not re-sent on a plain sync\. Ask again: `champollion sync --pair en:fr --redo keys:k1`/);
    } finally {
      await model.close();
    }
  });
});

describe('Round 4 — keys the gate refused are held back (no silent re-billing)', () => {
  it('a refused key is not re-sent to the same model; the run says how to retry or fill it; --redo keys: asks again', async () => {
    const model = await switchModel();
    try {
      const { d, env } = nextProject({ model, keys: 3 });
      model.state.refuse = new Set(['k2']);
      const first = await runCli(['sync'], d, env);
      assert.equal(first.code, 2, first.out);
      // Never "[OK]" for a file with keys left untranslated (finding 4).
      assert.doesNotMatch(first.out, /fr\.json \[OK\]/);
      assert.match(first.out, /fr\.json \[WARN\] 1 of 3 key\(s\) not translated \(1 refused by the quality gate\)/);
      assert.match(first.out, /1 key\(s\) are held back: .*the next sync will not send them to the same method again/);
      assert.match(first.out, /`champollion sync --pair en:fr --redo keys:k2`/);
      assert.match(first.out, /a "fallback" method on the pair .*"noTranslate".*by hand/);

      let before = model.calls.length;
      const second = await runCli(['sync'], d, env);
      assert.deepEqual(keysSent(model, before), [], 'held back: nothing sent');
      assert.match(second.out, /1 key\(s\) held back \(k2\): the quality gate refused local \(model stub-1\)'s translation/);
      assert.match(second.out, /Synced 0 key\(s\); 1 held back \(refused before; not sent, not billed\)/);
      assert.match(second.out, /en:fr\s+local\s+0\s+0\s+\$0 \(nothing sent\)/, 'the estimate does not price it');
      assert.match(second.out, /1 queued key\(s\) are held back — refused before by the same method, so not sent \(not billed\)/);

      // Naming the key is an explicit retry.
      model.state.refuse = new Set();
      before = model.calls.length;
      const named = await runCli(['sync', '--redo', 'keys:k2'], d, env);
      assert.equal(named.code, 0, named.out);
      assert.deepEqual(keysSent(model, before), ['k2']);
      assert.equal(lockOf(d).locales.fr.refused, undefined, 'the refusal is cleared once translated');
    } finally {
      await model.close();
    }
  });

  it('a change of model lifts the hold; a fallback added later is asked for the held key (the primary is not)', async () => {
    const model = await switchModel();
    try {
      const { d, cfg, env } = nextProject({ model, keys: 2 });
      model.state.refuse = new Set(['k1']);
      model.state.refuseFor = 'stub-1';
      await runCli(['sync'], d, env);
      // A fallback on the pair: only it is asked for k1.
      cfg({ languages: { fr: { fallback: { method: 'local', model: 'stub-fb' } } } });
      let before = model.calls.length;
      const fb = await runCli(['sync'], d, env);
      assert.equal(fb.code, 0, fb.out);
      assert.deepEqual(model.calls.slice(before).map(c => [c.model, c.keys]), [['stub-fb', ['k1']]]);
      assert.match(fb.out, /go to the fallback \(local\) only/);

      // A model change lifts a hold (the refusal was for the old model).
      const p2 = nextProject({ model, keys: 2 });
      model.state.refuse = new Set(['k0']);
      model.state.refuseFor = null;
      await runCli(['sync'], p2.d, p2.env);
      model.state.refuse = new Set();
      p2.cfg({ model: 'stub-3' });
      before = model.calls.length;
      await runCli(['sync'], p2.d, p2.env);
      assert.deepEqual(model.calls.slice(before).map(c => [c.model, c.keys]), [['stub-3', ['k0']]]);
    } finally {
      await model.close();
    }
  });
});

describe('Round 4 — hand edits survive a bulk redo; a source change records the replaced wording', () => {
  it('--redo all keeps a hand-fixed value and says so; --redo keys:<k> replaces it; a source change replaces it and records it', async () => {
    const model = await switchModel();
    try {
      const { d, src, env } = nextProject({ model, keys: 3 });
      await runCli(['sync'], d, env);
      const frPath = path.join(d, 'messages/fr.json');
      const fixed = { ...readJSON(frPath), k1: 'Bonjour numéro un, corrigé à la main' };
      writeJSON(frPath, fixed);

      const redo = await runCli(['sync', '--redo', 'all'], d, env);
      assert.equal(redo.code, 0, redo.out);
      assert.equal(readJSON(frPath).k1, fixed.k1, 'the reviewer\'s fix is kept');
      assert.match(redo.out, /kept 1 hand-edited value\(s\) \(k1\): a bulk redo never replaces a person's text\. `champollion sync --pair en:fr --redo keys:k1` replaces one/);

      // A model switch is a bulk redo too.
      const switched = await runCli(['sync', '--redo', 'all', '--fresh-on-model-change', '--model', 'stub-9'], d, env);
      assert.equal(readJSON(frPath).k1, fixed.k1, switched.out);

      // The source of the edited key changes: re-translated, wording kept on record.
      src.k1 = 'Hello number one, rewritten';
      writeJSON(path.join(d, 'messages/en.json'), src);
      const changed = await runCli(['sync'], d, env);
      assert.equal(changed.code, 0, changed.out);
      assert.notEqual(readJSON(frPath).k1, fixed.k1);
      assert.match(changed.out, /"k1" — replaced a hand-edited translation because its source text changed .* "Bonjour numéro un, corrigé à la main" \(kept in \.champollion-replaced-edits\.jsonl\)/);
      const record = read(path.join(d, '.champollion-replaced-edits.jsonl')).trim().split('\n').map(l => JSON.parse(l));
      assert.deepEqual(record.map(r => [r.locale, r.key, r.editedValue, r.why, r.newSource]),
        [['fr', 'k1', fixed.k1, 'source changed', 'Hello number one, rewritten']]);
      assert.match((await runCli(['status'], d, env)).out, /Replaced edits: 1 hand-edited translation\(s\) a sync replaced/);

      // Naming a hand-edited key replaces it (recorded too).
      writeJSON(frPath, { ...readJSON(frPath), k2: 'Fait main' });
      await runCli(['sync', '--redo', 'keys:k2'], d, env);
      assert.notEqual(readJSON(frPath).k2, 'Fait main');
      assert.equal(read(path.join(d, '.champollion-replaced-edits.jsonl')).trim().split('\n').length, 2);
    } finally {
      await model.close();
    }
  });

  it('sync --pair keeps the other locales\' records: a hand edit in de survives a later full --redo all', async () => {
    const model = await switchModel();
    try {
      const { d, env } = nextProject({ model, keys: 2, extra: { languages: ['fr', 'de'] } });
      await runCli(['sync'], d, env);
      const dePath = path.join(d, 'messages/de.json');
      writeJSON(dePath, { ...readJSON(dePath), k0: 'Von Hand' });
      await runCli(['sync', '--pair', 'en:fr', '--redo', 'all'], d, env);
      assert.ok(lockOf(d).locales.de?.written?.k0, 'de\'s record is still there after a fr-only run');
      const all = await runCli(['sync', '--redo', 'all'], d, env);
      assert.equal(readJSON(dePath).k0, 'Von Hand', all.out);
    } finally {
      await model.close();
    }
  });

  it('bootstrap (a lock from before this release): a value the cache holds is machine text, any other value is kept', async () => {
    const model = await switchModel();
    try {
      const { d, src, env } = nextProject({ model, keys: 3 });
      await runCli(['sync'], d, env);
      // Back to a version-1 lock: no written-records at all.
      writeJSON(path.join(d, '.champollion.lock'), lockOf(d).source);
      const frPath = path.join(d, 'messages/fr.json');
      writeJSON(frPath, { ...readJSON(frPath), k0: 'Écrit par quelqu\'un' });
      const before = model.calls.length;
      const redo = await runCli(['sync', '--redo', 'all', '--fresh'], d, env);
      assert.equal(redo.code, 0, redo.out);
      assert.equal(readJSON(frPath).k0, 'Écrit par quelqu\'un');
      assert.match(redo.out, /value\(s\) Champollion has no record of writing — made by hand, by another tool, or by an older version \(k0\)/);
      assert.deepEqual(keysSent(model, before).sort(), ['k1', 'k2'], 'the cached machine values are re-translated');
      assert.equal(lockOf(d).version, 2);
      void src;
    } finally {
      await model.close();
    }
  });
});

describe('Round 4 — an out-of-date translation is visible (i18next persona)', () => {
  it('a source edit whose re-translation failed: status lists it, audit fails with the repair, verify warns (and --strict fails)', async () => {
    const model = await startFakeModel((key, src) => (src.includes('edited') ? accent(src) : `FR ${src}`));
    try {
      const d = tmp('i18n');
      writeJSON(path.join(d, 'public/locales/en/common.json'), { greeting: 'Hello there my friend', bye: 'Goodbye for now friend' });
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'public/locales', languages: ['fr'], defaultMethod: 'local', model: 'm',
      });
      const env = { LOCAL_API_BASE: model.url };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      writeJSON(path.join(d, 'public/locales/en/common.json'), { greeting: 'Hello there my edited friend', bye: 'Goodbye for now friend' });
      const r = await runCli(['sync'], d, env);
      assert.equal(r.code, 1, `nothing was translated: exit 1\n${r.out}`);
      assert.equal(readJSON(path.join(d, 'public/locales/fr/common.json')).greeting, 'FR Hello there my friend', 'old text kept');

      assert.match((await runCli(['status'], d, env)).out,
        /out of date: 1 translation\(s\) were made from an older source text \(common::greeting\)/);
      const audit = await runCli(['audit'], d, env);
      assert.equal(audit.code, 1, audit.out);
      assert.match(audit.out, /fr: 1 translation\(s\) out of date — made from an older source text\n\s+- common::greeting/);
      assert.match(audit.out, /Repair: `champollion sync --pair en:fr` re-translates them; 1 of them were refused before and are held back — name them: `champollion sync --pair en:fr --redo keys:common::greeting`/);
      const auditJson = (await runCli(['audit', '--json'], d, env)).stdout.trim().split('\n').map(l => JSON.parse(l)).find(o => o.level === 'summary');
      assert.equal(auditJson.outOfDateCount, 1);
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 0, 'structure intact: a warning');
      assert.match(v.stderr, /\[VERIFY\] fr: 1 translation\(s\) out of date — made from an older source text: common::greeting/);
      const strict = await runCli(['verify', '--strict'], d, env);
      assert.equal(strict.code, 1);
      assert.match(strict.stderr, /\[FAIL\] \d+ warning\(s\) — --strict treats warnings as failures/);
      assert.doesNotMatch(strict.out, /Verification passed/, 'never an [OK] line over a failing --strict run');
    } finally {
      await model.close();
    }
  });
});

describe('Round 4 — the cache, the model and the bill, said plainly', () => {
  it('a redo served from the cache reads "free (cache)", not ~$0.0000', async () => {
    const model = await switchModel();
    try {
      const { d, env } = nextProject({ model, keys: 2, extra: {} });
      await runCli(['sync'], d, env);
      // An endpoint elsewhere has no price — but nothing goes to it here.
      const r = await runCli(['sync', '--redo', 'all', '--dry'], d, { LOCAL_API_BASE: 'http://10.255.0.1:9/v1' });
      assert.match(r.out, /en:fr\s+local\s+0\s+2\s+free \(cache\)/);
      assert.match(r.out, /Total: free — everything queued is served from the cache/);
      assert.doesNotMatch(r.out, /~\$0\.0000/);
    } finally {
      await model.close();
    }
  });

  it('switching method says why nothing came from the cache (it is kept per method)', async () => {
    const model = await switchModel();
    try {
      const { d, cfg, env } = nextProject({ model, keys: 2, modelName: 'm' });
      await runCli(['sync'], d, env);
      cfg({ defaultMethod: 'llm-coached', provider: 'local' });
      const r = await runCli(['sync', '--redo', 'all'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /0 served from the cache/);
      assert.match(r.out, /en:fr: 2 of the 2 key\(s\) sent to the model have translations in the cache from local · model m · register formal-vous — not reused: the cache is kept per method, register and coaching/);
    } finally {
      await model.close();
    }
  });

  it('status says when ALL the text on disk came from the previous model', async () => {
    const model = await switchModel();
    try {
      const { d, cfg, env } = nextProject({ model, keys: 3 });
      await runCli(['sync'], d, env);
      cfg({ model: 'stub-2' });
      const status = await runCli(['status'], d, env);
      assert.match(status.out, /earlier model: every translation in the files that can be attributed \(3 keys\) came from stub-1, not the current model \(stub-2\)\. To have the current model translate them: champollion sync --pair en:fr --redo all --fresh-on-model-change/);
      assert.equal(JSON.parse((await runCli(['status', '--json'], d, env)).stdout).pairs[0].fromEarlierModel, 'stub-1');
    } finally {
      await model.close();
    }
  });
});

// ── Django: gettext .po, fr + ru ────────────────────────────────────────────
const DJANGO_EN = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: en\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

#, python-format
msgid "One appointment booked today"
msgid_plural "%(count)d appointments booked today"
msgstr[0] ""
msgstr[1] ""

msgctxt "verb"
msgid "Open"
msgstr ""

msgid "Please <strong>book</strong> now"
msgstr ""
`;

async function djangoProject(model, langs = 'ru') {
  const d = tmp('django');
  write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), DJANGO_EN);
  const env = { LOCAL_API_BASE: model.url };
  const init = await runCli(['init', '--yes', '--langs', langs, '--method', 'local', '--model', 'stub-1'], d, env);
  assert.equal(init.code, 0, init.out);
  return { d, env, po: (lang) => path.join(d, `locale/${lang}/LC_MESSAGES/django.po`) };
}

describe('Round 4 — Django: the gate and verify holes', () => {
  it('a plural form handed back as the English with accents is refused like the singular', async () => {
    const model = await startFakeModel((key, src) => (src.startsWith('{n, plural')
      ? '{n, plural, one {Óne áppóintment bóoked tódáy} few {%(count)d áppóintments bóoked tódáy} many {%(count)d áppóintments bóoked tódáy} other {%(count)d áppóintments bóoked tódáy}}'
      : `Привет ${src.length}`));
    try {
      const { d, env } = await djangoProject(model);
      const r = await runCli(['sync'], d, env);
      assert.match(r.out, /"One appointment booked today": source echo \(the source handed back with only case, accents.*\) — in the plural form\(s\) "one", "few", "many", "other"/);
      assert.ok(!/Óne áppóintment/.test(read(path.join(d, 'locale/ru/LC_MESSAGES/django.po'))), 'never written');
    } finally {
      await model.close();
    }
  });

  it('verify fails a catalog whose </strong> was removed; the gate refuses it too', async () => {
    const model = await startFakeModel((key, src) => {
      if (src.includes('<strong>')) return 'Пожалуйста, <strong>запишитесь сейчас';
      if (src.startsWith('{n, plural')) return '{n, plural, one {Одна запись} few {%(count)d записи} many {%(count)d записей} other {%(count)d записи}}';
      return `Привет ${src.length}`;
    });
    try {
      const { d, env, po } = await djangoProject(model);
      const r = await runCli(['sync'], d, env);
      assert.match(r.out, /markup damaged: <\/strong> closes 0 time\(s\), 1 in the source/);
      // On disk (a catalog written before the check, or by hand): verify fails.
      const text = read(po('ru')).replace('msgid "Please <strong>book</strong> now"\nmsgstr ""', 'msgid "Please <strong>book</strong> now"\nmsgstr "Пожалуйста, <strong>запишитесь сейчас"');
      write(po('ru'), text);
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 1, v.out);
      assert.match(v.stderr, /markup error\(s\): Please <strong>book<\/strong> now \(<\/strong> closes 0 time\(s\), 1 in the source\)/);
    } finally {
      await model.close();
    }
  });

  it('fullwidth Latin letters in a Russian catalog fail the script check', async () => {
    const model = await startFakeModel((key, src) => `Привет ${src.length}`);
    try {
      const { d, env, po } = await djangoProject(model);
      await runCli(['sync'], d, env);
      write(po('ru'), read(po('ru')).replace(/msgctxt "verb"\nmsgid "Open"\nmsgstr "[^"]*"/, 'msgctxt "verb"\nmsgid "Open"\nmsgstr "Ｏｐｅｎ ｎｏｗ"'));
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 1, v.out);
      assert.match(v.stderr, /wrong script \(fullwidth Latin letters — English in disguise\): verb␄Open/);
    } finally {
      await model.close();
    }
  });

  it('verify --strict turns the Russian plural warning into a failing exit code', async () => {
    const model = await startFakeModel((key, src) => (src.startsWith('{n, plural')
      ? '{n, plural, one {Одна запись сегодня} other {%(count)d записей сегодня}}'
      : `Привет ${src.length} <strong>x</strong>`.replace(' <strong>x</strong>', src.includes('<strong>') ? ' <strong>запись</strong>' : '')));
    try {
      const { d, env } = await djangoProject(model);
      await runCli(['sync'], d, env);
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 0, v.out);
      assert.match(v.stderr, /repeat the "other" form/);
      const strict = await runCli(['verify', '--strict'], d, env);
      assert.equal(strict.code, 1, strict.out);
      const both = await runCli(['verify', '--strict', '--warn-only'], d, env);
      assert.equal(both.code, 1);
      assert.match(both.stderr, /contradict each other/);
    } finally {
      await model.close();
    }
  });

  it('a gettext context key can be typed as \\x04 in --redo keys:, and repair hints print that form', async () => {
    const model = await startFakeModel((key, src) => (src === 'Open' ? '' : src.startsWith('{n, plural')
      ? '{n, plural, one {Одна запись} few {%(count)d записи} many {%(count)d записей} other {%(count)d записи}}'
      : src.includes('<strong>') ? 'Пожалуйста, <strong>запишитесь</strong> сейчас' : `Привет ${src.length}`));
    try {
      const { d, env } = await djangoProject(model);
      const r = await runCli(['sync'], d, env);
      assert.match(r.out, /--redo 'keys:django::verb␄Open'  # type ␄ as \\x04 if you cannot \(both work\)/, 'both spellings in the repair command');
      assert.match(r.out, /verb␄Open/, 'key lists still show ␄');
      const before = model.calls.length;
      await runCli(['sync', '--redo', 'keys:django::verb\\x04Open'], d, env);
      const asked = model.calls.slice(before).flatMap(c => c.prompt.match(/"(?:msg_\d+|[^"]*)": "Open"/g) || []);
      assert.ok(asked.length > 0, 'the typed key re-queued "Open" (verb)');
    } finally {
      await model.close();
    }
  });
});

describe('Round 4 — lint that checked nothing fails (i18next persona)', () => {
  it('no source files: exit 1, naming where it looked', async () => {
    const d = tmp('lint');
    writeJSON(path.join(d, 'package.json'), { name: 'x', dependencies: { i18next: '23.0.0' } });
    writeJSON(path.join(d, 'public/locales/en/common.json'), { a: 'Hello' });
    writeJSON(path.join(d, 'champollion.config.json'), { inputLocale: 'en', localesDir: 'public/locales', languages: ['fr'] });
    const r = await runCli(['lint'], d);
    assert.equal(r.code, 1, r.out);
    assert.match(r.stderr, /Nothing linted: no \.tsx, \.jsx, \.ts, \.js files in src\/, app\/, pages\/, components\//);
    assert.match(r.stderr, /--src <dir>/);
    assert.equal((await runCli(['lint', '--warn-only'], d)).code, 0);
    const j = JSON.parse((await runCli(['lint', '--json'], d)).stdout);
    assert.equal(j.nothingChecked, true);
  });
});

describe('Round 4 — school persona: different inputs, same output', () => {
  const SENTENCE = 'kiskinwahamâtowikamik nikî-wâpahtên ôma anohc kîsikâw';
  it('one memorized sentence for several different strings is refused (the fallback takes them); synonyms pass; verify reports it on disk', async () => {
    const model = await startFakeModel((key, src, { model: m }) => {
      if (m === 'stub-fb') return `FB ${src}`;
      if (['Close', 'Dismiss'].includes(src)) return 'Fermer';
      return SENTENCE;
    });
    try {
      const d = tmp('school');
      writeJSON(path.join(d, 'messages/en.json'), {
        title: 'Springfield School app', contact: 'Contact the school', news: 'October newsletter', close: 'Close', dismiss: 'Dismiss',
      });
      writeJSON(path.join(d, 'champollion.config.json'), {
        inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'nmt',
        languages: { fr: { fallback: { method: 'local', model: 'stub-fb' } } },
      });
      const env = { LOCAL_API_BASE: model.url };
      const r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /same output for 3 different source strings/);
      const fr = readJSON(path.join(d, 'messages/fr.json'));
      assert.equal(fr.title, 'FB Springfield School app');
      assert.equal(fr.contact, 'FB Contact the school');
      assert.equal(fr.close, 'Fermer', 'synonyms collapsing to one short word pass');
      assert.equal(fr.dismiss, 'Fermer');

      // On disk (written before the check): verify fails on it (an error
      // since Round 5 — the gate refuses the same group), with the redo.
      writeJSON(path.join(d, 'messages/fr.json'), { ...fr, title: SENTENCE, contact: SENTENCE, news: SENTENCE });
      const v = await runCli(['verify'], d, env);
      assert.equal(v.code, 1);
      assert.match(v.stderr, /fr: 3 value\(s\) hold the same text for different source strings/);
      assert.match(v.stderr, /--redo keys:/);
    } finally {
      await model.close();
    }
  });
});

describe('Round 4 — school persona: an api endpoint that declares it follows no instructions', () => {
  /** A fake `api` endpoint (lib/methods/api.js contract) that always answers with an English echo. */
  async function startApi(answer) {
    const requests = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const parsed = JSON.parse(body || '{}');
        requests.push(parsed);
        const translations = {};
        for (const [k, v] of Object.entries(parsed.keys || {})) translations[k] = answer(k, v);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ translations, meta: { model: 'forge' } }));
      });
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    return { url: `http://127.0.0.1:${server.address().port}/translate`, requests, close: () => new Promise(r => server.close(r)) };
  }

  for (const [declared, expectRetry, line] of [
    [false, false, /not asked again: the endpoint declares it does not follow instructions, so it would return the same text/],
    [undefined, true, /asking once more \(the endpoint may ignore feedback: the api request carries it only when the pair declares "acceptsInstructions": true\)/],
    [true, true, /retrying with feedback/],
  ]) {
    it(`acceptsInstructions ${declared}: ${expectRetry ? 'asked again' : 'not asked again'}`, async () => {
      const api = await startApi((k, v) => accent(v));
      try {
        const d = tmp('api');
        writeJSON(path.join(d, 'messages/en.json'), { a: 'Welcome to our school today' });
        writeJSON(path.join(d, 'champollion.config.json'), {
          inputLocale: 'en', localesDir: 'messages',
          languages: { fr: { method: 'api', endpoint: api.url, apiKey: 'test', ...(declared !== undefined && { acceptsInstructions: declared }) } },
        });
        const r = await runCli(['sync'], d, {});
        assert.match(r.out, line);
        assert.equal(api.requests.length, expectRetry ? 2 : 1, r.out);
        if (declared === true) assert.match(api.requests[1].instructions.a, /RETRY/);
        else assert.equal(api.requests.every(q => q.instructions === undefined), true, 'no instructions sent unless declared');
      } finally {
        await api.close();
      }
    });
  }
});

describe('Round 4 — init and a language with two real orthographies', () => {
  it('init --yes --langs crk says a script choice is needed and how; --script records it; an unknown script fails', async () => {
    const d = tmp('crk');
    writeJSON(path.join(d, 'locales/en.json'), { a: 'Hello' });
    const r = await runCli(['init', '--yes', '--langs', 'crk'], d);
    assert.equal(r.code, 0, r.out);
    assert.match(r.stderr, /crk is written in more than one orthography — "Latn" \(SRO \(Standard Roman Orthography\)\) or "Cans" \(Cree Syllabics\)/);
    // Round 10: the config field, never a re-run of init (`init --force` rewrote the whole file).
    assert.match(r.stderr, /Choose it in champollion\.config\.json: add "script" to crk's entry in "languages" — "crk": \{"script": "Latn"\} \(or "script": "Cans"\)\./);
    assert.doesNotMatch(r.stderr, /init --force/);

    const ok = await runCli(['init', '--yes', '--force', '--langs', 'crk', '--script', 'crk=Cans'], d);
    assert.equal(ok.code, 0, ok.out);
    assert.deepEqual(readJSON(path.join(d, 'champollion.config.json')).languages, { crk: { script: 'Cans' } });
    assert.doesNotMatch(ok.stderr, /more than one orthography/);

    const bad = await runCli(['init', '--yes', '--force', '--langs', 'crk', '--script', 'crk=Grek'], d);
    assert.equal(bad.code, 1);
    assert.match(bad.stderr, /--script crk=Grek: Invalid "script" for crk/);
  });
});

// ── The CI guide and the docs the personas read ─────────────────────────────
describe('Round 4 — CI guide: partial runs keep paid work; pushes rebase', () => {
  const guide = read(new URL('../website/docs/guides/ci-cd.md', import.meta.url));
  const workflows = guide.split('```yaml').slice(1).map(b => b.slice(0, b.indexOf('```'))).filter(w => /champollion@0\.5 sync/.test(w) && /git push/.test(w));

  it('every sync workflow restores and saves the cache separately, saving even on failure', () => {
    assert.ok(workflows.length >= 2, 'both full workflows found');
    for (const w of workflows) {
      assert.match(w, /actions\/cache\/restore@v4/);
      assert.match(w, /actions\/cache\/save@v4/);
      assert.match(w, /- name: Save the translation cache\n\s+if: always\(\)/);
      assert.doesNotMatch(w, /uses: actions\/cache@v4/);
    }
  });
  it('commits what was translated on exit 2, then fails the job; rebases before pushing', () => {
    for (const w of workflows) {
      assert.match(w, /code=\$\?\n\s+echo "code=\$code" >> "\$GITHUB_OUTPUT"/);
      assert.match(w, /if \[ "\$code" -ne 0 \] && \[ "\$code" -ne 2 \]; then exit "\$code"; fi/);
      assert.match(w, /if: steps\.sync\.outputs\.code == '2'/);
      assert.match(w, /git pull --rebase origin "\$GITHUB_REF_NAME"\n\s+git push origin "HEAD:\$GITHUB_REF_NAME"/);
      // The commit step comes before the gate that can fail the job.
      assert.ok(w.indexOf('Commit updated') < w.indexOf('verify'), 'commit before verify');
    }
  });
  it('the gate table names audit\'s out-of-date failure and verify --strict', () => {
    assert.match(guide, /\| \*\*Audit\*\* \| `audit` \| .*out of date/);
    assert.match(guide, /\| \*\*Verify, strict\*\* \| `verify --strict` \|/);
  });
});

describe('Round 4 — docs say what the code does', () => {
  const doc = (rel) => read(new URL(`../website/docs/${rel}`, import.meta.url));
  it('quality gate: the 30-character exemption is for exact copies; disguised copies go by word count', () => {
    const qg = doc('concepts/quality-gate.md');
    assert.match(qg, /\*\*This exemption is about length, and only covers exact copies\.\*\*/);
    assert.match(qg, /\*\*three or more words\*\* carrying letters .*\*\*however short it is\*\*. `"Book an appointment"`/);
  });
  it('configuration: a new .po catalog gets the full msginit header', () => {
    const c = doc('getting-started/configuration.md');
    assert.doesNotMatch(c, /minimal header/);
    assert.match(c, /`Last-Translator: Automatically generated`, `Language-Team: none`/);
  });
  it('quick start: unchanged keys are skipped, not "served from the TM"', () => {
    const q = doc('getting-started/quick-start.md');
    assert.doesNotMatch(q, /unchanged key \(`hero\.subtitle`\) is served from/);
    assert.match(q, /is \*\*skipped\*\*/);
  });
});
