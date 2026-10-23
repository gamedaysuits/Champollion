/**
 * Round 12 synthetic personas, sync's notices about who wrote the files.
 *
 *   3. (Next.js) The redo warning said "10 source string(s)" for a 5-key
 *      en.json with two target languages: the 10 was translations, one per
 *      string per language. The notices now count translations and say what
 *      they are made of ("10 translations ... (5 strings × 2 languages)").
 *   8. (Django) A CI job that runs the CI guide's one-run hosted model
 *      (`sync --method llm --model … --max-cost 5`) over a project configured
 *      for a local model printed, on EVERY run and for each language, that
 *      the files were "written by local, not by llm", with a paid
 *      `--redo all`. When only this run's flags differ from the config, the
 *      configured setup's text is said once, quietly, as kept, and nothing
 *      is redone. A real change of the config keeps the full note; so does
 *      a dry run, where a switch is priced (Rounds 7-9).
 *
 * End to end through the real CLI against a tiny local model
 * (test/fixtures/fake-openai-model.mjs). The second method is `openai`
 * pointed at the same loopback model. No network, no real key.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { translationsBreakdown } from '../lib/cost-report.js';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-round12-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const tmp = (prefix) => fs.mkdtempSync(path.join(ROOT, `${prefix}-`));
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, obj) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
};
const setConfig = (d, patch) => {
  const file = path.join(d, 'champollion.config.json');
  writeJSON(file, { ...readJSON(file), ...patch });
};
const NO_CI = { CI: '', GITHUB_ACTIONS: '' };
const count = (text, needle) => text.split(needle).length - 1;

function project(src) {
  const d = tmp('proj');
  writeJSON(path.join(d, 'messages/en.json'), src);
  writeJSON(path.join(d, 'champollion.config.json'), {
    inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'm1', languages: ['fr', 'de'],
  });
  return d;
}

describe('Round 12 — 3: the model-change notices count translations, and say what they are made of', () => {
  it('translationsBreakdown: strings × languages when every language has the same count, else per language', () => {
    assert.equal(translationsBreakdown([{ target: 'fr', n: 5 }, { target: 'de', n: 5 }]), '5 strings × 2 languages');
    assert.equal(translationsBreakdown([{ target: 'fr', n: 1 }]), '1 string in fr');
    assert.equal(translationsBreakdown([{ target: 'fr', n: 3 }, { target: 'de', n: 5 }]), '3 in fr, 5 in de');
    assert.equal(translationsBreakdown([{ target: 'fr', n: 0 }, { target: 'de', n: 2 }]), '2 strings in de');
  });

  it('--redo all --fresh-on-model-change after a model change: "10 translations … (5 strings × 2 languages)"', async () => {
    const model = await startFakeModel((k, s, { model: m }) => `T(${m}) ${s}`);
    try {
      const src = {};
      for (let i = 0; i < 5; i++) src[`k${i}`] = `Hello number ${i} friend`;
      const d = project(src);
      const env = { LOCAL_API_BASE: model.url, ...NO_CI };
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      setConfig(d, { model: 'm2' });
      const r = await runCli(['sync', '--dry', '--redo', 'all', '--fresh-on-model-change'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /Model changed: re-translating everything with the new model \(--redo all --fresh-on-model-change\); 10 translations only an earlier model wrote \(5 strings × 2 languages\) will not be reused/);
      assert.doesNotMatch(r.out, /source string\(s\)|each counted once/);
    } finally {
      await model.close();
    }
  });
});

describe('Round 12 — 8: a one-run --method/--model over the configured setup says so once, quietly', () => {
  const answer = (k, s, { model: m }) => `T(${m}) ${s}`;
  const src = { save: 'Save your changes', open: 'Open the settings page' };
  const envFor = (model) => ({ LOCAL_API_BASE: model.url, OPENAI_API_BASE: model.url, OPENAI_API_KEY: 'sk-test', ...NO_CI });
  const QUIET = /\[INFO\] --method openai --model m2 apply to this run only: the 4 translations in the files the configured setup \(local · model m1\) wrote \(2 strings × 2 languages\) are kept, and nothing is redone — the flags translate new and changed keys only\./;

  it('a real run with the CI guide\'s flags: one line for the whole run, no per-language note, no redo offered', async () => {
    const model = await startFakeModel(answer);
    try {
      const d = project(src);
      const env = envFor(model);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      for (let run = 0; run < 2; run++) {
        const r = await runCli(['sync', '--method', 'openai', '--model', 'm2', '--max-cost', '5'], d, env);
        assert.equal(r.code, 0, r.out);
        assert.match(r.out, QUIET);
        assert.equal(count(r.out, 'apply to this run only'), 1, 'said once, not per language');
        assert.doesNotMatch(r.out, /were written by|--redo all/, 'no per-language note and no paid redo');
      }
      // The files keep the configured setup's text: nothing was sent.
      assert.equal(readJSON(path.join(d, 'messages/fr.json')).save, 'T(m1) Save your changes');
    } finally {
      await model.close();
    }
  });

  it('a one-run --model alone: the configured model\'s text is kept, said once', async () => {
    const model = await startFakeModel(answer);
    try {
      const d = project(src);
      const env = envFor(model);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const r = await runCli(['sync', '--model', 'm2'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /\[INFO\] --model m2 applies to this run only: the 4 translations in the files the configured setup \(local · model m1\) wrote \(2 strings × 2 languages\) are kept, and nothing is redone/);
      assert.doesNotMatch(r.out, /were written by|--fresh-on-model-change/);
    } finally {
      await model.close();
    }
  });

  it('new keys under the flags are translated by them; the quiet line counts only the configured setup\'s text', async () => {
    const model = await startFakeModel(answer);
    try {
      const d = project(src);
      const env = envFor(model);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      writeJSON(path.join(d, 'messages/en.json'), { ...src, close: 'Close the window now' });
      const r = await runCli(['sync', '--method', 'openai', '--model', 'm2'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.equal(readJSON(path.join(d, 'messages/fr.json')).close, 'T(m2) Close the window now');
      assert.match(r.out, QUIET);
    } finally {
      await model.close();
    }
  });

  it('a real change of the config\'s method keeps the full note, with the redo and its price', async () => {
    const model = await startFakeModel(answer);
    try {
      const d = project(src);
      const env = envFor(model);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      setConfig(d, { defaultMethod: 'openai', model: 'm2' });
      const r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /en:fr: 2 translation\(s\) in the files were written by local · model m1 · register \S+ \(2\), not by openai · model m2/);
      // Round 13: two pairs, one command for both and its total (each pair's
      // count and price on its own line above it).
      assert.match(r.out, /en:fr: .*\(re-translating them: 2 key\(s\) to openai, /);
      assert.match(r.out, /To have openai translate them, all at once: `champollion sync --redo all` — sends 4 key\(s\) \(2 for en:de, 2 for en:fr\) — total: /);
      assert.doesNotMatch(r.out, /apply to this run only|applies to this run only/);
    } finally {
      await model.close();
    }
  });

  it('a real change of the config\'s model keeps the full note too', async () => {
    const model = await startFakeModel(answer);
    try {
      const d = project(src);
      const env = envFor(model);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      setConfig(d, { model: 'm2' });
      const r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /2 pairs keep an earlier model's text — a model change alone re-translates nothing\. To re-translate them with it: `champollion sync --redo all --fresh-on-model-change`/);
      assert.doesNotMatch(r.out, /applies to this run only/);
    } finally {
      await model.close();
    }
  });

  it('text an EARLIER flag run wrote is not the configured setup\'s: it keeps the full note', async () => {
    const model = await startFakeModel(answer);
    try {
      const d = project(src);
      const env = envFor(model);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      // One run re-translated everything with m3 (not the config's model).
      assert.equal((await runCli(['sync', '--model', 'm3', '--redo', 'all', '--fresh-on-model-change'], d, env)).code, 0);
      const r = await runCli(['sync', '--model', 'm2'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /written by m3 \(2\), not the model for this run \(--model m2\)/);
      assert.doesNotMatch(r.out, /applies to this run only/, 'm3 is not the configured setup');
    } finally {
      await model.close();
    }
  });

  it('a DRY run with the flags keeps the full note: that is where a switch is priced', async () => {
    const model = await startFakeModel(answer);
    try {
      const d = project(src);
      const env = envFor(model);
      assert.equal((await runCli(['sync'], d, env)).code, 0);
      const r = await runCli(['sync', '--dry', '--method', 'openai', '--model', 'm2'], d, env);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /en:fr: 2 translation\(s\) in the files were written by local · model m1 · register \S+ \(2\), not by openai · model m2 · register \S+ \(as this run sets it\) \(re-translating them: 2 key\(s\) to openai/);
      assert.match(r.out, /2 pairs keep another method's text\. Nothing would change: .* `champollion sync --method openai --model m2 --redo all` — sends 4 key\(s\)/);
      assert.doesNotMatch(r.out, /apply to this run only/);
    } finally {
      await model.close();
    }
  });
});
