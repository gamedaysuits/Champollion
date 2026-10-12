/**
 * translate + project_dir runs the project pair's "fallback" as `champollion
 * sync` runs it (the CLI's own translateWithFallback).
 *
 * The finding (2026-10): a string the pair's method answers badly — "Home" →
 * a repetition loop the quality gate refuses — failed in the translate tool
 * while `champollion sync` in the same project filled it from the pair's
 * fallback. Proven here with the REAL champollion package: the pair's method
 * is a fake OpenAI-compatible model on loopback (method "local"), its
 * fallback a stub champollion API endpoint on loopback (method "api"). No
 * key, no network beyond 127.0.0.1.
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

const LOOP = 'Accueil accueil accueil accueil accueil accueil accueil accueil accueil accueil';
/** The pair's own method: "Home" and "Delete" come back as a loop the gate refuses. */
const PRIMARY = { Home: LOOP, 'Save changes': 'Enregistrer les modifications', Delete: LOOP };
/** The fallback: "Home" well, "Delete" as badly as the method. */
const FALLBACK = { Home: 'Accueil', 'Save changes': 'Enregistrer', Delete: LOOP };

/** A stub champollion API endpoint (POST /translate), recording what it is
 *  asked; with `token`, it answers only that bearer (401 otherwise). */
async function startApiStub(dictionary, { token = null } = {}) {
  const asked = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      if (token && req.headers.authorization !== `Bearer ${token}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'unauthorized', message: 'missing or wrong bearer token' } }));
        return;
      }
      const { keys = {} } = JSON.parse(body || '{}');
      asked.push(...Object.values(keys));
      const translations = Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, dictionary[v] ?? `?${v}`]));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ translations, meta: { model: 'stub-fallback' } }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${server.address().port}/translate`,
    asked,
    close: () => new Promise((r) => server.close(r)),
  };
}

describe('translate — project_dir runs the pair\'s fallback as `champollion sync` does', () => {
  let fake;
  let api;
  let champollion;
  let runCli;
  const projects = [];
  const saved = {};

  before(async () => {
    champollion = await loadChampollion();
    if (!existsSync(FAKE_MODEL) || !champollion?.resolvePairs) return;
    const fixture = await import(pathToFileURL(FAKE_MODEL).href);
    runCli = fixture.runCli;
    fake = await fixture.startFakeModel((key, source) => PRIMARY[source] ?? `?${source}`);
    api = await startApiStub(FALLBACK);
    // The local engine reads its endpoint from the process environment, and
    // an exported OpenRouter key must never turn a regression into a billed call.
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

  /** A project whose fr pair runs "local" (model weak), with `fr` as its languages entry. */
  function project(fr) {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-fallback-'));
    projects.push(dir);
    mkdirSync(join(dir, 'locales'));
    writeFileSync(join(dir, 'locales', 'en.json'), JSON.stringify({ home: 'Home' }));
    writeFileSync(join(dir, 'champollion.config.json'), JSON.stringify({
      inputLocale: 'en', localesDir: 'locales', defaultMethod: 'local', model: 'weak', languages: { fr },
    }));
    return dir;
  }
  const ready = (t) => {
    if (!fake) { t.skip('the champollion CLI is not reachable here'); return false; }
    return true;
  };

  it('a text the method\'s gate refuses is filled by the fallback, labelled with its method — and cached where sync finds it', async (t) => {
    if (!ready(t)) return;
    const P = project({ fallback: { method: 'api', endpoint: api.url } });
    const askedBefore = api.asked.length;
    const r = await translateTexts(
      { texts: ['Home', 'Save changes', 'Delete'], source: 'en', target: 'fr', projectDir: P },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);

    // "Home": refused from the method, translated by the fallback, and said so.
    assert.equal(r.results[0].translation, 'Accueil');
    assert.equal(r.results[0].by_fallback, true);
    assert.match(r.results[0].engine_failure, /repetition/);
    // "Save changes": the method's own answer, no fallback label.
    assert.equal(r.results[1].translation, PRIMARY['Save changes']);
    assert.equal(r.results[1].by_fallback, undefined);
    // "Delete": refused by both — still a failure, with both reasons.
    assert.equal(r.results[2].translation, null);
    assert.match(r.results[2].failure, /repetition.*then the pair's fallback \(api/s);
    // Only what the method could not translate went to the fallback ("Delete"
    // twice: the gate's one corrective retry, as in sync).
    assert.deepEqual([...new Set(api.asked.slice(askedBefore))], ['Home', 'Delete']);

    assert.deepEqual(
      { tm_hits: r.counts.tm_hits, translated: r.counts.translated, fallback: r.counts.fallback, failed: r.counts.failed },
      { tm_hits: 0, translated: 1, fallback: 1, failed: 1 });
    assert.equal(r.fallback.method, 'api');
    assert.equal(r.fallback.endpoint, api.url);
    assert.equal(r.fallback.status, 'ran');
    assert.equal(r.fallback.attempted, 2);
    assert.equal(r.fallback.accepted, 1);

    const text = formatTranslateResult(r);
    assert.match(text, /1 newly translated, 1 by the pair's fallback \(api\), 1 failed\./);
    assert.match(text, /^Engine: local \(the project's configured method\) · model weak/m);
    assert.match(text, new RegExp(`^Fallback: api · model chosen by the endpoint · endpoint ${api.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'));
    assert.match(text, /it translated \[0\]; 1 it could not translate either/);
    assert.match(text, /^\[0\] \(by the fallback: api · model chosen by the endpoint\) Accueil$/m);
    assert.match(text, /^\[1\] Enregistrer les modifications$/m);
    assert.match(text, /^\[2\] FAILED: /m);

    // Cached under the FALLBACK's own key (the CLI's tmMethodKey of the
    // fallback sync resolves), never under the method's; nothing refused cached.
    const fb = champollion.resolvePairs(champollion.resolveConfig({}, P)).get('en:fr').fallback;
    assert.equal(r.fallback.tm_key, champollion.tmMethodKey(fb));
    const tm = JSON.parse(readFileSync(join(P, '.champollion', 'tm.json'), 'utf-8'));
    const entries = Object.values(tm).filter((e) => e && typeof e.t === 'string');
    assert.ok(entries.some((e) => e.t === 'Accueil' && e.m === r.fallback.tm_key), JSON.stringify(entries));
    assert.ok(!entries.some((e) => e.t === LOOP), 'a refused answer is never cached');

    // Again: served from the fallback's cache — the method is not asked
    // again for what the fallback already translated (sync's ladder).
    const modelCalls = fake.calls.length;
    const asked = api.asked.length;
    const again = await translateTexts({ texts: ['Home'], source: 'en', target: 'fr', projectDir: P }, { champollion, env: {} });
    assert.equal(again.results[0].translation, 'Accueil');
    assert.equal(again.results[0].from_tm, true);
    assert.equal(again.results[0].by_fallback, true);
    assert.equal(fake.calls.length, modelCalls, 'the pair\'s method was not asked');
    assert.equal(api.asked.length, asked, 'nor the fallback');
    // Marked as the instructions promise: whose cache answered it (Round 12).
    assert.match(formatTranslateResult(again), /^\[0\] \(cache: fallback\) \(by the fallback: api/m);

    // And `champollion sync` there serves the same entry: no request anywhere.
    const s = await runCli(['sync'], P, { LOCAL_API_BASE: fake.url, CHAMPOLLION_NO_UPDATE_CHECK: '1' });
    assert.equal(s.code, 0, s.out);
    assert.deepEqual(JSON.parse(readFileSync(join(P, 'locales', 'fr.json'), 'utf-8')), { home: 'Accueil' });
    assert.equal(fake.calls.length, modelCalls);
    assert.equal(api.asked.length, asked);
  });

  it('use_tm false: the fallback still fills the text, and nothing is read from or written to the project\'s memory', async (t) => {
    if (!ready(t)) return;
    const P = project({ fallback: { method: 'api', endpoint: api.url } });
    const r = await translateTexts(
      { texts: ['Home'], source: 'en', target: 'fr', projectDir: P, useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.results[0].translation, 'Accueil');
    assert.equal(r.results[0].by_fallback, true);
    assert.equal(r.results[0].from_tm, false);
    assert.equal(r.fallback.tm_key, null);
    assert.equal(existsSync(join(P, '.champollion', 'tm.json')), false);
  });

  it('without a fallback configured, nothing changes: the refused text is a failure, and no fallback is named', async (t) => {
    if (!ready(t)) return;
    const P = project({});
    const asked = api.asked.length;
    const r = await translateTexts(
      { texts: ['Home', 'Save changes'], source: 'en', target: 'fr', projectDir: P, useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.fallback, null);
    assert.equal(r.results[0].translation, null);
    assert.match(r.results[0].failure, /^repetition hallucination/);
    assert.doesNotMatch(r.results[0].failure, /fallback/);
    assert.equal(r.results[1].translation, PRIMARY['Save changes']);
    assert.deepEqual({ translated: r.counts.translated, fallback: r.counts.fallback, failed: r.counts.failed },
      { translated: 1, fallback: 0, failed: 1 });
    const text = formatTranslateResult(r);
    assert.doesNotMatch(text, /^Fallback:/m);
    assert.doesNotMatch(text, /by the pair's fallback/);
    assert.equal(api.asked.length, asked);
  });

  it('without project_dir, no fallback is applied', async (t) => {
    if (!ready(t)) return;
    const asked = api.asked.length;
    const r = await translateTexts(
      { texts: ['Home', 'Save changes'], source: 'en', target: 'fr', method: 'local', model: 'weak', useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.fallback, null);
    assert.equal(r.results[0].translation, null);
    assert.match(r.results[0].failure, /^repetition hallucination/);
    assert.equal(r.counts.fallback, 0);
    assert.doesNotMatch(formatTranslateResult(r), /^Fallback:/m);
    assert.equal(api.asked.length, asked);
  });

  it('the fallback runs in the project, as in sync: its "apiKey": "${VAR}" comes from the project\'s .env', async (t) => {
    if (!ready(t)) return;
    // Sync runs IN the project; the CLI pipeline reads a method's key from
    // process.cwd()'s .env. Run from this server, that is the project only
    // while the fallback runs — never the server's own directory.
    const guarded = await startApiStub(FALLBACK, { token: 'tok-from-project-env' });
    try {
      assert.equal(process.env.FALLBACK_TOKEN, undefined);
      const P = project({ fallback: { method: 'api', endpoint: guarded.url, apiKey: '${FALLBACK_TOKEN}' } });
      writeFileSync(join(P, '.env'), 'FALLBACK_TOKEN=tok-from-project-env\n');
      const r = await translateTexts(
        { texts: ['Home'], source: 'en', target: 'fr', projectDir: P, useTm: false },
        { champollion, env: {} });
      assert.equal(r.status, 'ok', r.note);
      assert.equal(r.results[0].translation, 'Accueil', r.results[0].failure);
      assert.equal(r.results[0].by_fallback, true);
      assert.deepEqual(guarded.asked, ['Home']);
      assert.notEqual(process.cwd(), P, 'outside the fallback call, the working directory is the real one');
    } finally {
      await guarded.close();
    }
  });

  it('a fallback that cannot run refuses the call before anything is sent, as sync\'s preflight does', async (t) => {
    if (!ready(t)) return;
    const P = project({ fallback: { method: 'llm', model: 'google/gemini-3.5-flash' } });
    const modelCalls = fake.calls.length;
    const r = await translateTexts(
      { texts: ['Home'], source: 'en', target: 'fr', projectDir: P, useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'needs-key');
    assert.match(r.note, /fallback \(method "llm"\) that cannot run/);
    assert.match(r.note, /OPENROUTER_API_KEY/);
    assert.equal(fake.calls.length, modelCalls, 'nothing was sent');
  });
});

// ================================================================
// The two ways the fallback pipeline is reached, on an injected package:
// its own export (translateWithFallback) is used when present; a package
// that offers none never skips the fallback silently — the answer says it
// was not applied and what sync would do.
// ================================================================
describe('translate — where the fallback pipeline comes from', () => {
  const P = mkdtempSync(join(tmpdir(), 'mcp-fallback-mock-'));
  after(() => rmSync(P, { recursive: true, force: true }));

  /** A stand-in champollion whose project pair en:fr runs "local" with a fallback "local:strong". */
  function stub({ withPipeline }) {
    const fallback = { source: 'en', target: 'fr', method: 'local', model: 'strong', isFallback: true };
    const pair = { source: 'en', target: 'fr', method: 'local', model: 'weak', fallback };
    const calls = { pipeline: [] };
    return {
      calls,
      resolveCode: (c) => c,
      getLanguageCard: () => ({ name: 'French' }),
      resolveConfig: () => ({ inputLocale: 'en' }),
      resolvePairs: () => new Map([['en:fr', pair]]),
      tmMethodKey: (pc) => `${pc.method}|${pc.model}`,
      validateTranslations: (tr) => {
        const validated = {};
        const failures = [];
        for (const [k, v] of Object.entries(tr)) {
          if (v === LOOP) failures.push({ key: k, reason: 'repetition hallucination', value: v });
          else validated[k] = v;
        }
        return { validated, failures };
      },
      getMethod: (m, pc) => ({
        translate: async (keys, src) => Object.fromEntries(keys.map((k) => [k, PRIMARY[src[k]]])),
        checkReadiness: () => ({ ready: true }),
        _getDefaultModel: () => pc.model,
      }),
      ...(withPipeline ? {
        translateWithFallback: async (keys, src, pc, label, opts) => {
          calls.pipeline.push({ keys: [...keys], method: pc.method, model: pc.model, label, held: opts.noSendFallback?.size ?? 0 });
          if (opts.noSendFallback) return { translated: null, failures: [] }; // the cache-only pass
          return { translated: Object.fromEntries(keys.map((k) => [k, FALLBACK[src[k]]])), failures: [], sentCount: keys.length };
        },
      } : {}),
    };
  }

  it('the package\'s own translateWithFallback is the one run, with the fallback\'s config', async () => {
    const champ = stub({ withPipeline: true });
    const r = await translateTexts({ texts: ['Home', 'Save changes'], source: 'en', target: 'fr', projectDir: P, useTm: false },
      { champollion: champ, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.deepEqual(champ.calls.pipeline.map((c) => [c.keys, c.model, c.label]), [[['t0'], 'strong', 'en:fr (fallback: local)']]);
    assert.equal(r.results[0].translation, 'Accueil');
    assert.equal(r.results[0].by_fallback, true);
    assert.equal(r.results[1].translation, PRIMARY['Save changes']);
    assert.match(formatTranslateResult(r), /^\[0\] \(by the fallback: local · model strong\) Accueil$/m);
  });

  it('a package with no fallback pipeline: the fallback is reported NOT applied, never skipped silently', async () => {
    const champ = stub({ withPipeline: false });
    const r = await translateTexts({ texts: ['Home', 'Save changes'], source: 'en', target: 'fr', projectDir: P, useTm: false },
      { champollion: champ, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.fallback.status, 'unavailable');
    assert.equal(r.results[0].translation, null);
    assert.match(r.results[0].failure, /repetition hallucination; the pair's fallback \(local · model strong[^)]*\) was not applied: .*`champollion sync` there would send this text to it/);
    assert.match(formatTranslateResult(r), /^Fallback: local · model strong.* — .*NOT APPLIED/m);
  });
});
