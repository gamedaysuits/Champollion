/**
 * Round 12 (Next.js persona), translate with project_dir after the project's
 * model changed from stub-1 to stub-2: a row served from stub-1's cache came
 * back marked only "(TM)", under an Engine line naming stub-2. The server
 * instructions promise each row a `cache: pair` / `cache: fallback` mark (the
 * JSON carried it since Round 11; the text never showed it), and sync says
 * when a file keeps an earlier model's text.
 *
 * Now every cached row is marked as the instructions say, and a row another
 * setup wrote says which, against the setup the Engine (or Fallback) line
 * names — in the text and in the JSON (`written_by`).
 *
 * Real champollion, a fake OpenAI-compatible model on loopback; no key, no
 * network beyond loopback.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  translateTexts, formatTranslateResult, loadChampollion, writerOf,
} from '../src/tools/translate.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FAKE_MODEL = resolve(__dirname, '../../cli/test/fixtures/fake-openai-model.mjs');

describe('translate — a cached row says whose cache answered it, and who wrote it', () => {
  const DICT = { 'Save changes': 'Enregistrer (stub-2)', 'Delete account': 'Supprimer (stub-2)' };
  let fake;
  let PROJ;
  const saved = {};
  before(async () => {
    if (!existsSync(FAKE_MODEL)) return;
    const { startFakeModel } = await import(pathToFileURL(FAKE_MODEL).href);
    fake = await startFakeModel((key, source) => DICT[source] ?? `?${source}`);
    PROJ = mkdtempSync(join(tmpdir(), 'mcp-r12-writer-'));
    mkdirSync(join(PROJ, 'messages'));
    writeFileSync(join(PROJ, 'messages', 'en.json'), JSON.stringify({ save: 'Save changes', remove: 'Delete account' }));
    for (const k of ['LOCAL_API_BASE', 'OPENROUTER_API_KEY']) saved[k] = process.env[k];
    process.env.LOCAL_API_BASE = fake.url;
    delete process.env.OPENROUTER_API_KEY;
  });
  after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    await fake?.close();
    if (PROJ) rmSync(PROJ, { recursive: true, force: true });
  });
  const writeConfig = (model) => writeFileSync(join(PROJ, 'champollion.config.json'), JSON.stringify({
    inputLocale: 'en', localesDir: 'messages', languages: ['fr'], defaultMethod: 'local', model,
  }));

  /** The project's cache, as `champollion sync` with `model` would have filled it. */
  function seedAs(champollion, model, entries) {
    writeConfig(model);
    const pc = champollion.resolvePairs(champollion.resolveConfig({}, PROJ)).get('en:fr');
    const tm = champollion.loadTM(PROJ);
    for (const [src, out] of Object.entries(entries)) champollion.storeTM(tm, src, 'fr', champollion.tmMethodKey(pc), out);
    champollion.saveTM(PROJ, tm);
    return champollion.tmMethodKey(pc);
  }

  it('after the config\'s model changed: the stub-1 row says stub-1 wrote it, not the Engine line\'s stub-2', async (t) => {
    const champollion = await loadChampollion();
    if (!fake || !champollion?.resolvePairs || typeof champollion.servingMethodKey !== 'function') {
      t.skip('the champollion CLI is not reachable here');
      return;
    }
    const oldKey = seedAs(champollion, 'stub-1', { 'Save changes': 'Enregistrer (stub-1)' });
    writeConfig('stub-2');
    const r = await translateTexts(
      { texts: ['Save changes', 'Delete account'], source: 'en', target: 'fr', projectDir: PROJ },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.engine.model, 'stub-2', 'the project\'s model now');

    const [carried, fresh] = r.results;
    assert.equal(carried.translation, 'Enregistrer (stub-1)', 'model carry-over serves the earlier model\'s answer, as sync does');
    assert.equal(carried.cache, 'pair');
    assert.deepEqual(carried.written_by, {
      key: oldKey, method: 'local', model: 'stub-1', label: 'model stub-1', instead_of: 'model stub-2', model_carryover: true,
    });
    assert.equal(fresh.cache, undefined, 'the other text was translated now');
    assert.equal(fresh.written_by, undefined);
    assert.equal(r.counts.cached_by_other_setup, 1);
    assert.equal(r.translation_memory.writers_known, true);

    const text = formatTranslateResult(r);
    assert.match(text, /Engine: local \(the project's configured method\) · model stub-2/);
    assert.match(text, /^\[0\] \(cache: pair — written by model stub-1, not the model stub-2 the Engine line names\) Enregistrer \(stub-1\)$/m);
    assert.match(text, /^\[1\] Supprimer \(stub-2\)$/m, 'a fresh row carries no cache mark');
    assert.doesNotMatch(text, /\(TM\)/, 'the old unexplained mark is gone');
    assert.match(text, /1 cached answer was written by model stub-1, not the setup named above — reused as `champollion sync` reuses them \(a model change alone re-translates nothing\)\. To translate them with the setup named above, pass use_tm: false \(in the project, `champollion sync --redo all --fresh-on-model-change` re-translates the files\)\./);
  });

  it('a row the same setup wrote is marked "cache: pair" and nothing more', async (t) => {
    const champollion = await loadChampollion();
    if (!fake || !champollion?.resolvePairs || typeof champollion.servingMethodKey !== 'function') {
      t.skip('the champollion CLI is not reachable here');
      return;
    }
    seedAs(champollion, 'stub-2', { 'Delete account': 'Supprimer (cached stub-2)' });
    const r = await translateTexts(
      { texts: ['Delete account'], source: 'en', target: 'fr', projectDir: PROJ },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.results[0].cache, 'pair');
    assert.equal(r.results[0].written_by, undefined);
    const text = formatTranslateResult(r);
    assert.match(text, /^\[0\] \(cache: pair\) Supprimer \(cached stub-2\)$/m);
    assert.doesNotMatch(text, /written by|not the setup named above/);
  });
});

describe('writerOf — who wrote a cached answer, in words', () => {
  const pkg = { describeMethodKey: (k) => `described(${k})` };

  it('the same key, or an unknown writer, says nothing', () => {
    assert.equal(writerOf('local|m|r|', 'local|m|r|', pkg), null);
    assert.equal(writerOf(null, 'local|m|r|', pkg), null);
    assert.equal(writerOf('local|m|r|', undefined, pkg), null);
  });

  it('another model of the same method, register and coaching is model carry-over, named by model', () => {
    assert.deepEqual(writerOf('local|stub-1|formal|', 'local|stub-2|formal|', pkg), {
      key: 'local|stub-1|formal|', method: 'local', model: 'stub-1',
      label: 'model stub-1', instead_of: 'model stub-2', model_carryover: true,
    });
  });

  it('any other difference names the whole setup, through the CLI\'s own wording', () => {
    const w = writerOf('local|stub-1|informal|', 'local|stub-2|formal|', pkg);
    assert.equal(w.model_carryover, false);
    assert.equal(w.label, 'described(local|stub-1|informal|)');
    assert.equal(w.instead_of, 'described(local|stub-2|formal|)');
  });
});
