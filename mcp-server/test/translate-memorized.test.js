/**
 * translate + project_dir refuses what `champollion sync` there refuses: the
 * sentence the project's cache remembers a model repeating for different
 * source strings, and a sentence the project's files already hold for a
 * different source.
 *
 * The finding (Round 10, school persona): the project's sync had caught the
 * trained model answering three app strings with one memorized sentence and
 * remembered it (`verify` knew it too), yet this tool returned that sentence
 * as the translation of "Please bring the forms." with no warning — its
 * repeat check compared only the texts of the one call.
 *
 * With the REAL champollion package: the pair's method is a stub champollion
 * `api` endpoint on loopback (the persona's trained model, which takes no
 * instructions), its fallback the CLI's fake OpenAI-compatible model on
 * loopback (method "local"). No key, no network beyond 127.0.0.1.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { translateTexts, formatTranslateResult, loadChampollion } from '../src/tools/translate.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FAKE_MODEL = resolve(__dirname, '../../cli/test/fixtures/fake-openai-model.mjs');

const MEM = 'Mani nasisa kaka mamama kimika sisisa mamama sani mamama.';
const ONCE = 'Siyo kayo mamama kope sisisa mamama sani mamama towape.';
/** The trained model: one memorized sentence for several texts. */
const MODEL_ANSWERS = {
  'Welcome, families': MEM,
  'Send the form': MEM,
  'Contact the school': MEM,
  'Please bring the forms.': MEM,
  'Lunch is in the gym today': ONCE,
  'The elders visit the class tomorrow.': ONCE,
};

async function startApiStub(answers) {
  const asked = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      const { keys = {} } = JSON.parse(body || '{}');
      asked.push(...Object.values(keys));
      const translations = Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, answers[v] ?? `Rud ${v.length} kenik`]));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ translations }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}/translate`, asked, close: () => new Promise((r) => server.close(r)) };
}

/** The fallback's answer: the text's words reversed — never the memorized sentence. */
const fallbackAnswer = (s) => `Kika ${s.split(' ').reverse().join(' ').toLowerCase().replace(/[^a-z{} ]/g, '')}`;

describe('translate — project_dir refuses the sentences the project knows a model repeats', () => {
  let fake;
  let api;
  let champollion;
  let runCli;
  const projects = [];
  const saved = {};

  before(async () => {
    champollion = await loadChampollion();
    if (!existsSync(FAKE_MODEL) || typeof champollion?.projectSharedOutputIndex !== 'function') return;
    const fixture = await import(pathToFileURL(FAKE_MODEL).href);
    runCli = fixture.runCli;
    fake = await fixture.startFakeModel((key, source) => fallbackAnswer(source));
    api = await startApiStub(MODEL_ANSWERS);
    for (const k of ['LOCAL_API_BASE', 'OPENROUTER_API_KEY', 'CHAMPOLLION_API_KEY']) saved[k] = process.env[k];
    process.env.LOCAL_API_BASE = fake.url;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.CHAMPOLLION_API_KEY;
  });
  after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    await fake?.close();
    await api?.close();
    for (const p of projects) rmSync(p, { recursive: true, force: true });
  });

  /** The school's project after its first `champollion sync`. */
  async function syncedSchool({ fallback = true, messages } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-memorized-'));
    projects.push(dir);
    mkdirSync(join(dir, 'app', 'messages'), { recursive: true });
    writeFileSync(join(dir, 'app', 'messages', 'en.json'), JSON.stringify(messages || {
      Home: { title: 'Welcome, families', lunch: 'Lunch is in the gym today' },
      Forms: { submit: 'Send the form' },
      Nav: { contact: 'Contact the school' },
    }));
    writeFileSync(join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3, inputLocale: 'en', localesDir: './app/messages', languages: { crk: { script: 'Latn' } }, defaultMethod: 'api',
      pairs: { 'en:crk': { method: 'api', endpoint: api.url, acceptsInstructions: false, ...(fallback ? { fallback: { method: 'local', model: 'stub-1' } } : {}) } },
    }));
    // Without a fallback the three refused keys fail the run (exit 1); the
    // sentence is remembered either way.
    const s = await runCli(['sync'], dir, { LOCAL_API_BASE: fake.url, CHAMPOLLION_NO_UPDATE_CHECK: '1', CI: '', GITHUB_ACTIONS: '' });
    assert.ok(existsSync(join(dir, '.champollion', 'tm.json')), s.out);
    return dir;
  }
  const ready = (t) => {
    if (!fake) { t.skip('the champollion CLI (with projectSharedOutputIndex) is not reachable here'); return false; }
    return true;
  };

  it('the sentence sync remembered as memorized is refused for a new text, and the pair\'s fallback translates it', async (t) => {
    if (!ready(t)) return;
    const P = await syncedSchool();
    const tm = JSON.parse(readFileSync(join(P, '.champollion', 'tm.json'), 'utf-8'));
    assert.deepEqual(tm._meta.memorized?.crk, [MEM], 'the first sync remembered the sentence');

    const r = await translateTexts(
      { texts: ['Please bring the forms.'], source: 'en', target: 'crk', projectDir: P },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.notEqual(r.results[0].translation, MEM);
    assert.equal(r.results[0].translation, fallbackAnswer('Please bring the forms.'));
    assert.equal(r.results[0].by_fallback, true);
    assert.match(r.results[0].engine_failure, /a memorized sentence, not a translation of this string/);
    assert.match(formatTranslateResult(r), /by the fallback/);
    // The refused answer is never cached.
    const after = JSON.parse(readFileSync(join(P, '.champollion', 'tm.json'), 'utf-8'));
    assert.ok(!Object.values(after).some((e) => e && e.t === MEM), 'the memorized sentence is not cached');
  });

  it('without a fallback, it is a failure that says why — never the memorized sentence as a translation', async (t) => {
    if (!ready(t)) return;
    const P = await syncedSchool({ fallback: false });
    const r = await translateTexts(
      { texts: ['Please bring the forms.'], source: 'en', target: 'crk', projectDir: P, useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.results[0].translation, null);
    assert.match(r.results[0].failure, /memorized sentence/);
    assert.equal(r.counts.failed, 1);
  });

  it('a sentence the project\'s files already hold for a different source is refused too (sync\'s scope, not one call\'s)', async (t) => {
    if (!ready(t)) return;
    const P = await syncedSchool({ messages: { Home: { lunch: 'Lunch is in the gym today' } } });
    const crk = JSON.parse(readFileSync(join(P, 'app', 'messages', 'crk.json'), 'utf-8'));
    assert.equal(crk.Home.lunch, `${ONCE}`, 'the app holds the sentence for its own source');
    const r = await translateTexts(
      { texts: ['The elders visit the class tomorrow.'], source: 'en', target: 'crk', projectDir: P },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.results[0].translation, fallbackAnswer('The elders visit the class tomorrow.'));
    assert.match(r.results[0].engine_failure, /same output for 2 different source strings \("Lunch is in the gym today", "The elders visit the class tomorrow\."\)/);
  });

  it('without project_dir nothing is known beyond the call: one text, one answer, as before', async (t) => {
    if (!ready(t)) return;
    const r = await translateTexts(
      { texts: ['Please bring the forms.'], source: 'en', target: 'crk', method: 'api', endpoint: api.url, script: 'Latn', useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.results[0].translation, MEM);
  });
});
