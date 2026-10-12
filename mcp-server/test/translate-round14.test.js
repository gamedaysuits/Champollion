/**
 * Round 14 (Django persona): MCP `translate` without a context, for
 * "Cancel", which the project's catalog has under two contexts (msgctxt
 * "button" and "dialog"). The answer listed both contexts and then said to
 * pass `context: "button"`, as if there were only one. Now: when a text has
 * several contexts, the answer lists them and asks for the one meant, never
 * picking one; when each text has one, it gives the exact argument — a
 * string for a single text, an array (one slot per text) otherwise, since a
 * string would apply to every text of the call.
 *
 * A real .po project synced by the real CLI (bin/cli.js), a fake
 * OpenAI-compatible model on loopback; no key, no network beyond loopback.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { translateTexts, formatTranslateResult, loadChampollion, contextOnlyLine } from '../src/tools/translate.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FAKE_MODEL = resolve(__dirname, '../../cli/test/fixtures/fake-openai-model.mjs');

const EN_PO = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: en\\n"

msgctxt "button"
msgid "Cancel"
msgstr ""

msgctxt "dialog"
msgid "Cancel"
msgstr ""

msgctxt "menu"
msgid "Open"
msgstr ""

msgid "Hello"
msgstr ""
`;

describe('translate — a text the project has under several contexts: listed, never picked', () => {
  let fake;
  let PROJ;
  let runCli;
  const saved = {};

  before(async () => {
    if (!existsSync(FAKE_MODEL)) return;
    const fixture = await import(pathToFileURL(FAKE_MODEL).href);
    runCli = fixture.runCli;
    fake = await fixture.startFakeModel((key, source) => `FR ${source}`);
    PROJ = mkdtempSync(join(tmpdir(), 'mcp-r14-ctx-'));
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

  it('"Cancel" (button, dialog): both are named, and the caller is asked for the one meant — no `context: "button"`', async (t) => {
    const champollion = await loadChampollion();
    if (!fake || typeof champollion?.tmSourceText !== 'function' || typeof champollion?.sourceTextContexts !== 'function') {
      t.skip('the champollion CLI is not reachable here');
      return;
    }
    const env = { CI: '', GITHUB_ACTIONS: '', CHAMPOLLION_OFFLINE: '1', LOCAL_API_BASE: fake.url };
    assert.equal((await runCli(['init', '--yes', '--langs', 'fr', '--method', 'local', '--model', 'stub-1'], PROJ, env)).code, 0);
    const sync = await runCli(['sync'], PROJ, env);
    assert.equal(sync.code, 0, sync.out);

    const one = await translateTexts(
      { texts: ['Cancel'], source: 'en', target: 'fr', projectDir: PROJ },
      { champollion, env: {} });
    assert.equal(one.status, 'ok', one.note);
    assert.deepEqual(one.results[0].project_contexts, ['button', 'dialog']);
    const text = formatTranslateResult(one);
    assert.match(text, /Context: \[0\] "Cancel" \(msgctxt "button", "dialog"\)/);
    assert.match(text, /"Cancel" is 2 entries — "button" and "dialog"\. Pass the context you mean: context: "<one of them>" — this call does not pick one for you\./);
    assert.doesNotMatch(text, /Pass context: "button"/);
    assert.doesNotMatch(text, /Pass context: "dialog"/);

    // Several texts: the ambiguous one is named by its index; the answer asks for an array.
    const three = await translateTexts(
      { texts: ['Hello', 'Cancel', 'Open'], source: 'en', target: 'fr', projectDir: PROJ },
      { champollion, env: {} });
    const t3 = formatTranslateResult(three);
    assert.match(t3, /\[1\] "Cancel" is 2 entries — "button" and "dialog"\. Pass the context you mean: context as an array, one per text \(null for a text with none\) — this call does not pick one for you\./);
    assert.doesNotMatch(t3, /Pass context: "/);

    // One context each: the exact argument, one slot per text.
    const two = await translateTexts(
      { texts: ['Hello', 'Open'], source: 'en', target: 'fr', projectDir: PROJ },
      { champollion, env: {} });
    assert.match(formatTranslateResult(two), /Pass context: \[null,"menu"\] \(one per text, null for none\) to use and fill the entries sync uses\./);
    // A single text with a single context: a string.
    const open = await translateTexts(
      { texts: ['Open'], source: 'en', target: 'fr', projectDir: PROJ },
      { champollion, env: {} });
    assert.match(formatTranslateResult(open), /Pass context: "menu" to use and fill the entry sync uses\./);
  });

  it('the line itself: never a single context when there are several, an array when the call has other texts', () => {
    const r = (list, n) => ({ project_context_only: list, results: new Array(n).fill({}) });
    const several = contextOnlyLine(r([{ index: 0, text: 'Cancel', contexts: ['button', 'dialog'] }], 1));
    assert.match(several, /Pass the context you mean/);
    assert.doesNotMatch(several, /Pass context: "button"/);
    assert.match(contextOnlyLine(r([{ index: 0, text: 'Cancel', contexts: ['button'] }], 1)), /Pass context: "button" to use/);
    assert.match(contextOnlyLine(r([{ index: 1, text: 'Cancel', contexts: ['button'] }], 2)), /Pass context: \[null,"button"\]/);
    assert.match(contextOnlyLine(r([{ index: 0, text: 'A', contexts: ['x'] }, { index: 1, text: 'B', contexts: ['x'] }], 2)), /Pass context: "x" to use/);
    assert.match(contextOnlyLine(r([{ index: 0, text: 'A', contexts: ['x'] }, { index: 1, text: 'B', contexts: ['y'] }], 2)), /Pass context: \["x","y"\]/);
    assert.equal(contextOnlyLine({ project_context_only: [] }), null);
  });
});
