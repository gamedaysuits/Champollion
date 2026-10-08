/**
 * Round 13 (Django persona): MCP `translate` had no msgctxt argument. With
 * project_dir, "Cancel" missed the entry `champollion sync` had cached for
 * the catalog's `msgctxt "button"` entry (sync keys the cache with the
 * context folded in), and the call wrote a context-free entry into the
 * project's tm.json beside it.
 *
 * Now `context` keys the cache as sync does and is told to the model; and
 * without it, a text the project has ONLY with a context is translated
 * without reading or writing the project's cache, and the answer says which
 * context to pass.
 *
 * A real .po project synced by the real CLI (bin/cli.js), a fake
 * OpenAI-compatible model on loopback; no key, no network beyond loopback.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  translateTexts, formatTranslateResult, loadChampollion, contextsFor,
} from '../src/tools/translate.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FAKE_MODEL = resolve(__dirname, '../../cli/test/fixtures/fake-openai-model.mjs');

const EN_PO = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: en\\n"

msgctxt "button"
msgid "Cancel"
msgstr ""

msgid "Hello"
msgstr ""
`;

describe('translate — a gettext context keys the cache as sync does', () => {
  let fake;
  let PROJ;
  let runCli;
  const saved = {};
  // The model answers per text, and says when it was told the context.
  const answer = (key, source, { prompt }) => {
    if (source === 'Cancel') return /Context \(msgctxt\): button/.test(prompt) && /"(msg_\d+|t\d+)": "Cancel"/.test(prompt) ? 'Annuler (bouton)' : 'Annuler';
    if (source === 'Delete') return /Context \(msgctxt\): verb/.test(prompt) ? 'Supprimer (verbe)' : 'Supprimer';
    return `FR ${source}`;
  };
  const tmEntries = () => Object.keys(JSON.parse(readFileSync(join(PROJ, '.champollion', 'tm.json'), 'utf8'))).filter((k) => k !== '_meta').length;

  before(async () => {
    if (!existsSync(FAKE_MODEL)) return;
    const fixture = await import(pathToFileURL(FAKE_MODEL).href);
    runCli = fixture.runCli;
    fake = await fixture.startFakeModel(answer);
    PROJ = mkdtempSync(join(tmpdir(), 'mcp-r13-ctx-'));
    mkdirSync(join(PROJ, 'locale', 'en', 'LC_MESSAGES'), { recursive: true });
    writeFileSync(join(PROJ, 'locale', 'en', 'LC_MESSAGES', 'django.po'), EN_PO);
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

  it('context "button" is served from the entry sync cached for msgctxt "button"; without it, the project\'s cache is not touched and the answer says so', async (t) => {
    const champollion = await loadChampollion();
    if (!fake || typeof champollion?.tmSourceText !== 'function' || typeof champollion?.sourceTextContexts !== 'function') {
      t.skip('the champollion CLI is not reachable here');
      return;
    }
    const env = { CI: '', GITHUB_ACTIONS: '', CHAMPOLLION_OFFLINE: '1', LOCAL_API_BASE: fake.url };
    assert.equal((await runCli(['init', '--yes', '--langs', 'fr', '--method', 'local', '--model', 'stub-1'], PROJ, env)).code, 0);
    const sync = await runCli(['sync'], PROJ, env);
    assert.equal(sync.code, 0, sync.out);
    assert.match(readFileSync(join(PROJ, 'locale', 'fr', 'LC_MESSAGES', 'django.po'), 'utf8'), /msgctxt "button"\nmsgid "Cancel"\nmsgstr "Annuler \(bouton\)"/);
    const entries = tmEntries();

    // With the context: sync's own entry, no engine call.
    let calls = fake.calls.length;
    const withCtx = await translateTexts(
      { texts: ['Cancel'], source: 'en', target: 'fr', projectDir: PROJ, context: 'button' },
      { champollion, env: {} });
    assert.equal(withCtx.status, 'ok', withCtx.note);
    assert.equal(fake.calls.length, calls, 'served from the cache');
    assert.equal(withCtx.results[0].translation, 'Annuler (bouton)');
    assert.equal(withCtx.results[0].cache, 'pair');
    assert.equal(withCtx.results[0].context, 'button');
    assert.match(formatTranslateResult(withCtx), /\[0\] \(msgctxt "button"\) \(cache: pair\) Annuler \(bouton\)/);

    // Without it: translated, the project's cache neither read nor written for it.
    calls = fake.calls.length;
    const bare = await translateTexts(
      { texts: ['Cancel', 'Hello'], source: 'en', target: 'fr', projectDir: PROJ },
      { champollion, env: {} });
    assert.equal(bare.status, 'ok', bare.note);
    assert.equal(bare.results[0].from_tm, false, 'sync\'s context-keyed entry is not served for the bare text');
    assert.deepEqual(bare.results[0].project_contexts, ['button']);
    assert.equal(bare.results[1].cache, 'pair', '"Hello" (no context in the project) still uses the cache');
    assert.ok(fake.calls.length > calls);
    assert.equal(tmEntries(), entries, 'no context-free entry written');
    assert.deepEqual(bare.project_context_only, [{ index: 0, text: 'Cancel', contexts: ['button'] }]);
    const text = formatTranslateResult(bare);
    assert.match(text, /Context: \[0\] "Cancel" \(msgctxt "button"\) — the project has this text only as gettext entries with a context/);
    // (Round 14: a call of two texts gets one slot per text — a bare "button" would apply to "Hello" too.)
    assert.match(text, /Pass context: \["button",null\] \(one per text, null for none\) to use and fill the entries sync uses\./);

    // A context the project does not have yet: told to the model, cached under it.
    const verb = await translateTexts(
      { texts: ['Delete'], source: 'en', target: 'fr', projectDir: PROJ, context: 'verb' },
      { champollion, env: {} });
    assert.equal(verb.results[0].translation, 'Supprimer (verbe)', 'the model was told the context');
    assert.equal(tmEntries(), entries + 1);
    const again = await translateTexts(
      { texts: ['Delete'], source: 'en', target: 'fr', projectDir: PROJ, context: 'verb' },
      { champollion, env: {} });
    assert.equal(again.results[0].cache, 'pair', 'the context-keyed entry serves the next call');
    const otherCtx = await translateTexts(
      { texts: ['Delete'], source: 'en', target: 'fr', projectDir: PROJ, context: 'noun' },
      { champollion, env: {} });
    assert.equal(otherCtx.results[0].from_tm, false, 'another context is another entry');
  });

  it('a context per text, or one for all; a wrong shape is refused before anything is sent', () => {
    assert.deepEqual(contextsFor('button', ['a', 'b']), { list: ['button', 'button'] });
    assert.deepEqual(contextsFor(['button', null], ['a', 'b']), { list: ['button', null] });
    assert.deepEqual(contextsFor('', ['a']), { list: [''] }, 'msgctxt "" is a context');
    assert.match(contextsFor(['x'], ['a', 'b']).error, /context has 1 entry for 2 text\(s\)/);
    assert.match(contextsFor('a\u0004b', ['a']).error, /cannot contain U\+0004/);
    assert.match(contextsFor(3, ['a']).error, /context must be a string/);
  });
});
