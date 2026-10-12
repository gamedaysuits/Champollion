/**
 * Tests for the translate tool (src/tools/translate.js).
 *
 * The champollion package is injected as a mock (deps.champollion) so no
 * network or filesystem is touched; the mock honors the real API shapes
 * (translateBatch, partitionByTM {hits,misses}, validateTranslations
 * {validated,failures}). The economy contract is the test surface: TM hits
 * are free, only misses reach the engine, gate failures are explicit, and
 * degraded states (no package, no key) are actionable messages.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  translateTexts,
  formatTranslateResult,
  cachedDiscardedNote,
  resolveMethodKey,
  METHOD_ENV,
} from '../src/tools/translate.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** Build a mock champollion package with an in-memory TM and call ledger. */
function mockChampollion({ tmSeed = {}, failTexts = [] } = {}) {
  const tmStore = { ...tmSeed }; // key: `${source}|${locale}|${method}`
  const calls = { translateBatch: [], saveTM: 0 };
  return {
    calls,
    tmStore,
    resolveCode: (c) => c,
    getLanguageCard: (c) => ({ name: c.toUpperCase(), dir: 'ltr', scripts: null }),
    getRegister: () => 'neutral register',
    DEFAULT_OPENROUTER_MODEL: 'test/model-1',
    DEFAULT_BATCH_SIZE: 20,
    loadTM: () => tmStore,
    partitionByTM: (tm, sourceFlat, keys, locale, method) => {
      const hits = {};
      const misses = [];
      for (const k of keys) {
        const cached = tm[`${sourceFlat[k]}|${locale}|${method}`];
        if (cached) hits[k] = cached;
        else misses.push(k);
      }
      return { hits, misses };
    },
    storeTM: (tm, source, locale, method, translation) => {
      tm[`${source}|${locale}|${method}`] = translation;
    },
    saveTM: () => { calls.saveTM += 1; },
    translateBatch: async (keys, sourceFlat, pairConfig, options) => {
      calls.translateBatch.push({ keys: [...keys], apiKey: options.apiKey });
      const out = {};
      for (const k of keys) out[k] = `XL(${sourceFlat[k]})`;
      return out;
    },
    validateTranslations: (translations, sourceFlat) => {
      const validated = {};
      const failures = [];
      for (const [k, v] of Object.entries(translations)) {
        if (failTexts.includes(sourceFlat[k])) {
          failures.push({ key: k, reason: 'length inflation' });
        } else {
          validated[k] = v;
        }
      }
      return { validated, failures };
    },
    getMethod: () => ({
      estimateCost: (n) => ({ estimatedCost: n * 0.001, currency: 'USD', source: 'test' }),
    }),
  };
}

const ENV = { OPENROUTER_API_KEY: 'sk-test' };

describe('resolveMethodKey', () => {
  it('maps every declared method to its env vars', () => {
    for (const m of Object.keys(METHOD_ENV)) {
      const { envVar } = resolveMethodKey(m, {});
      assert.ok(envVar, `${m} must name an env var`);
    }
    assert.equal(resolveMethodKey('llm', ENV).key, 'sk-test');
    assert.equal(resolveMethodKey('deepl', ENV).key, null);
  });

  it('METHOD_ENV is derived from shared/method-registry.json (SSOT parity)', () => {
    // Load the SSOT the same way the module does and re-derive independently.
    const candidates = [
      resolve(__dirname, '../../shared/method-registry.json'),
      resolve(__dirname, '../../cli/shared/method-registry.json'),
    ];
    const regPath = candidates.find((p) => existsSync(p));
    assert.ok(regPath, 'method-registry.json must be reachable from the test');
    const registry = JSON.parse(readFileSync(regPath, 'utf-8'));
    const expected = {};
    for (const [key, entry] of Object.entries(registry.entries)) {
      if (Array.isArray(entry.runtimes) && !entry.runtimes.includes('cli')) continue;
      expected[entry.cli_name || key] = entry.credential_env || entry.env || [];
    }
    assert.deepEqual(METHOD_ENV, expected,
      'METHOD_ENV drifted from shared/method-registry.json — it is derived, never hand-edited');
    // Harness-only entries must NOT surface as MCP methods (MCP shells the CLI).
    for (const [key, entry] of Object.entries(registry.entries)) {
      if (Array.isArray(entry.runtimes) && !entry.runtimes.includes('cli')) {
        assert.ok(!(key in METHOD_ENV), `${key} is harness-only and must not be an MCP method`);
      }
    }
  });

  it('credential_env_all methods need EVERY var (translated: id+secret)', () => {
    const partial = { LARA_ACCESS_KEY_ID: 'id-only' };
    assert.equal(resolveMethodKey('translated', partial).key, null,
      'one of two required Lara vars must not unlock the method');
    const full = { LARA_ACCESS_KEY_ID: 'id', LARA_ACCESS_KEY_SECRET: 'secret' };
    assert.ok(resolveMethodKey('translated', full).key);
  });

  it('the old hand-mirror wrongness stays dead: GOOGLE_API_KEY does not unlock gemini', () => {
    assert.equal(resolveMethodKey('gemini', { GOOGLE_API_KEY: 'x' }).key, null,
      'the CLI reads only GEMINI_API_KEY; claiming GOOGLE_API_KEY unlocks gemini was the drift');
  });
});

describe('translateTexts economy contract', () => {
  it('degrades honestly when champollion is not installed', async () => {
    const r = await translateTexts(
      { texts: ['hi'], source: 'en', target: 'fr' }, { champollion: null });
    assert.equal(r.status, 'unavailable');
    assert.ok(r.note.includes('npm install champollion'));
  });

  it('names the missing env var instead of failing opaquely', async () => {
    const r = await translateTexts(
      { texts: ['hi'], source: 'en', target: 'fr', method: 'deepl' },
      { champollion: mockChampollion(), env: {} });
    assert.equal(r.status, 'needs-key');
    assert.ok(r.note.includes('DEEPL_API_KEY'));
  });

  it('translates misses, stores survivors in the TM, reports cost', async () => {
    const mock = mockChampollion();
    const r = await translateTexts(
      { texts: ['hello', 'world'], source: 'en', target: 'fr' },
      { champollion: mock, env: ENV });
    assert.equal(r.status, 'ok');
    assert.equal(r.counts.tm_hits, 0);
    assert.equal(r.counts.translated, 2);
    assert.equal(r.results[0].translation, 'XL(hello)');
    assert.equal(mock.calls.translateBatch.length, 1);
    assert.equal(mock.calls.saveTM, 1);
    assert.equal(r.estimated_api_cost.estimatedCost, 0.002);
    // Survivors persisted under (source|locale|method)
    assert.equal(mock.tmStore['hello|fr|llm'], 'XL(hello)');
  });

  it('TM hits are free — the engine is only called for misses', async () => {
    const mock = mockChampollion({ tmSeed: { 'hello|fr|llm': 'bonjour' } });
    const r = await translateTexts(
      { texts: ['hello', 'fresh'], source: 'en', target: 'fr' },
      { champollion: mock, env: ENV });
    assert.equal(r.counts.tm_hits, 1);
    assert.equal(r.results[0].translation, 'bonjour');
    assert.equal(r.results[0].from_tm, true);
    assert.deepEqual(mock.calls.translateBatch[0].keys, ['t1']); // only the miss
  });

  it('an all-TM call never touches the engine at all', async () => {
    const mock = mockChampollion({ tmSeed: { 'hello|fr|llm': 'bonjour' } });
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr' },
      { champollion: mock, env: ENV });
    assert.equal(mock.calls.translateBatch.length, 0);
    assert.equal(r.counts.translated, 0);
    assert.equal(r.counts.failed, 0);
  });

  it('quality-gate failures are explicit and are NOT stored in the TM', async () => {
    const mock = mockChampollion({ failTexts: ['sketchy'] });
    const r = await translateTexts(
      { texts: ['sketchy', 'fine'], source: 'en', target: 'fr' },
      { champollion: mock, env: ENV });
    assert.equal(r.counts.failed, 1);
    assert.equal(r.results[0].translation, null);
    assert.equal(r.results[0].failure, 'length inflation');
    assert.ok(!('sketchy|fr|llm' in mock.tmStore));
    assert.equal(mock.tmStore['fine|fr|llm'], 'XL(fine)');
  });

  it('use_tm=false bypasses cache read and write', async () => {
    const mock = mockChampollion({ tmSeed: { 'hello|fr|llm': 'bonjour' } });
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr', useTm: false },
      { champollion: mock, env: ENV });
    assert.equal(r.counts.tm_hits, 0);
    assert.equal(mock.calls.translateBatch.length, 1);
    assert.equal(mock.calls.saveTM, 0);
  });

  it('caps batch size with advice instead of a silent trim', async () => {
    const r = await translateTexts(
      { texts: Array(51).fill('x'), source: 'en', target: 'fr' },
      { champollion: mockChampollion(), env: ENV });
    assert.equal(r.status, 'bad-request');
    assert.ok(r.note.includes('max 50'));
  });

  it('rejects unknown methods with the available list', async () => {
    const r = await translateTexts(
      { texts: ['x'], source: 'en', target: 'fr', method: 'carrier-pigeon' },
      { champollion: mockChampollion(), env: ENV });
    assert.equal(r.status, 'bad-request');
    assert.ok(r.note.includes('llm'));
  });
});

// The TM must be keyed on the FULL method key (method|model|register|coaching),
// not the bare method name: a model or register switch must be a cache MISS,
// never a stale-style re-serve. Mirrors cli/lib/tm.js tmMethodKey.
describe('translateTexts TM keyed on full method key (model/register switches miss)', () => {
  /** Mock with the real package's tmMethodKey shape (method|model|register|coaching). */
  function mockWithTmMethodKey(opts = {}) {
    const mock = mockChampollion(opts);
    mock.tmMethodKey = (pairConfig) =>
      `${pairConfig.method || 'llm'}|${pairConfig.model || ''}|${pairConfig.register || ''}|`;
    return mock;
  }

  it('same text + different MODEL is a cache miss in both directions', async () => {
    const mock = mockWithTmMethodKey();

    // Populate the TM under model A.
    await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr', model: 'prov/model-a' },
      { champollion: mock, env: ENV });
    assert.equal(mock.calls.translateBatch.length, 1, 'cold cache — engine called');

    // Model B must MISS (no stale model-A re-serve) and populate its own slot.
    const rB = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr', model: 'prov/model-b' },
      { champollion: mock, env: ENV });
    assert.equal(rB.counts.tm_hits, 0, 'model switch must not re-serve the old model output');
    assert.equal(mock.calls.translateBatch.length, 2, 'engine consulted for the new model');

    // Back to model A: its entry is still there → MISS must not happen either way.
    const rA = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr', model: 'prov/model-a' },
      { champollion: mock, env: ENV });
    assert.equal(rA.counts.tm_hits, 1, 'model A entry survives under its own key');
    assert.equal(mock.calls.translateBatch.length, 2, 'no engine call for the model-A hit');
  });

  it('same text + different REGISTER is a cache miss in both directions', async () => {
    const mock = mockWithTmMethodKey();

    await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr', register: 'formal vous' },
      { champollion: mock, env: ENV });
    assert.equal(mock.calls.translateBatch.length, 1);

    const rCasual = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr', register: 'casual tu' },
      { champollion: mock, env: ENV });
    assert.equal(rCasual.counts.tm_hits, 0, 'register switch must not re-serve the old-register output');
    assert.equal(mock.calls.translateBatch.length, 2);

    const rFormal = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr', register: 'formal vous' },
      { champollion: mock, env: ENV });
    assert.equal(rFormal.counts.tm_hits, 1, 'formal entry survives under its own key');
    assert.equal(mock.calls.translateBatch.length, 2);
  });

  it('same text + same model + same register is a HIT', async () => {
    const mock = mockWithTmMethodKey();

    await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr', model: 'prov/model-a', register: 'formal vous' },
      { champollion: mock, env: ENV });
    const r2 = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr', model: 'prov/model-a', register: 'formal vous' },
      { champollion: mock, env: ENV });

    assert.equal(r2.counts.tm_hits, 1, 'identical request must be served from TM');
    assert.equal(r2.results[0].from_tm, true);
    assert.equal(mock.calls.translateBatch.length, 1, 'engine called only for the cold run');
  });

  it('falls back to the bare method when champollion does not export tmMethodKey (older installs)', async () => {
    // mockChampollion() has no tmMethodKey — entries land under the bare
    // method name, matching how pre-tmMethodKey champollion versions keyed
    // their TMs (read/write compatible with those installs).
    const mock = mockChampollion({ tmSeed: { 'hello|fr|llm': 'bonjour' } });
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr' },
      { champollion: mock, env: ENV });
    assert.equal(r.counts.tm_hits, 1, 'bare-method fallback still reads the legacy TM');
    assert.equal(mock.calls.translateBatch.length, 0);
  });
});

describe('formatTranslateResult', () => {
  it('shows the TM savings and failure honesty in the text', async () => {
    const mock = mockChampollion({
      tmSeed: { 'hello|fr|llm': 'bonjour' }, failTexts: ['bad'] });
    const r = await translateTexts(
      { texts: ['hello', 'bad', 'good'], source: 'en', target: 'fr' },
      { champollion: mock, env: ENV });
    const text = formatTranslateResult(r);
    assert.ok(text.includes('1/3 free from Translation Memory'));
    assert.ok(text.includes('(cache: pair) bonjour'), 'the row says whose cache answered it, as the instructions promise');
    assert.ok(text.includes('FAILED: length inflation'));
    assert.ok(text.includes('Nothing invalid was returned'));
  });
});

// ================================================================
// The local engine is keyless (0.2.0)
//
// language_overview's DEPLOY step points at method "local" (a model behind
// an OpenAI-compatible server on this machine). The registry lists its
// endpoint vars (LOCAL_API_BASE…) next to an optional gateway key, and the
// old any-of key check demanded one of them — so translate refused a working
// Ollama with "needs LOCAL_API_BASE", and sent the OpenRouter default slug
// as the model. Keylessness is DERIVED from the registry's loopback
// default_base_url, never a name list.
// ================================================================
import { METHOD_KEYLESS } from '../src/tools/translate.js';

describe('translate — keyless local engine', () => {
  it('the registry marks exactly the loopback-default engines keyless', () => {
    assert.equal(METHOD_KEYLESS.local, true);
    assert.equal(METHOD_KEYLESS.llm, false);
    assert.equal(METHOD_KEYLESS.deepl, false);
  });

  it('method "local" runs with no env at all, no OpenRouter slug, and no endpoint passed off as a key', async () => {
    const champ = mockChampollion();
    const seen = [];
    champ.translateBatch = async (keys, sourceFlat, pairConfig, options) => {
      seen.push({ model: pairConfig.model, apiKey: options.apiKey });
      return Object.fromEntries(keys.map((k) => [k, `XL(${sourceFlat[k]})`]));
    };
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'crk', method: 'local', useTm: false },
      { champollion: champ, env: { LOCAL_API_BASE: 'http://localhost:11434/v1' } },
    );
    assert.equal(r.status, 'ok', r.note);
    assert.equal(seen[0].model, undefined, 'the engine applies its own default model');
    assert.equal(seen[0].apiKey, undefined, 'LOCAL_API_BASE is an endpoint, not a key');
  });

  it('a keyed engine still says which key it needs', async () => {
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr', method: 'deepl' },
      { champollion: mockChampollion(), env: {} },
    );
    assert.equal(r.status, 'needs-key');
    assert.match(r.note, /DEEPL_API_KEY/);
  });
});

// ================================================================
// Targeting the model you just deployed (0.2.0)
//
// A synthetic user served their own model with `nmt-forge serve` and passed
// an endpoint to translate. The tool had no such argument; zod stripped it
// silently and the call ran on a different local model. Now: base_url
// (method local/openai — the /v1 URL serve prints) and endpoint (method api —
// serve's /translate) are real arguments; the engine is VERIFIED to have
// taken them; anything that would not reach the engine is refused; and the
// answer names the engine, model and endpoint that actually ran.
// ================================================================
import { mkdtempSync, rmSync, writeFileSync as writeFileSyncT } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * A mock whose getMethod returns a real-shaped engine: an OpenAI-format lane
 * resolves its base like DirectLLMMethod (this.options.baseUrl > env >
 * default); the api transport takes pairConfig.endpoint like getMethod does.
 */
function mockWithEngines(opts = {}) {
  const champ = mockChampollion(opts);
  champ.engineCalls = [];
  champ.tmRoots = [];
  const loadTM = champ.loadTM;
  champ.loadTM = (root) => { champ.tmRoots.push(root); return loadTM(root); };
  champ.getMethod = (method, pairConfig) => {
    const engine = {
      options: {},
      estimateCost: async () => ({ estimatedCost: null, currency: 'USD', source: 'local-unknown' }),
      async translate(keys, sourceFlat, pc, options) {
        champ.engineCalls.push({
          method, keys: [...keys], options,
          base: this._resolveApiBase ? this._resolveApiBase() : null,
          endpoint: this.endpoint ?? null,
        });
        if (opts.engineFails) {
          console.log('[INFO] ✓ batch started');
          console.error(`[ERR] ${opts.engineFails}`);
          return null;
        }
        return Object.fromEntries(keys.map((k) => [k, `XL(${sourceFlat[k]})`]));
      },
    };
    if (method === 'local' || method === 'openai') {
      engine._getDefaultModel = () => (method === 'local' ? 'llama3.1' : 'gpt-4o');
      engine._resolveApiBase = function resolveApiBase() {
        const b = this.options.baseUrl || (method === 'local' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1');
        return String(b).replace(/\/+$/, '');
      };
    }
    if (method === 'api') engine.endpoint = pairConfig.endpoint;
    return engine;
  };
  champ.tmMethodKey = (pc) => `${pc.method}|${pc.method === 'api' ? pc.endpoint : (pc.model || '')}|${pc.register || ''}|`;
  return champ;
}

const FORGE_V1 = 'http://127.0.0.1:8378/v1';
const FORGE_API = 'http://127.0.0.1:8378/translate';

describe('translate — targeting a deployed model', () => {
  it('method "local" + base_url: the request goes to that server, and the answer says so', async () => {
    const champ = mockWithEngines();
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'crk', method: 'local', baseUrl: FORGE_V1, useTm: false },
      { champollion: champ, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(champ.engineCalls[0].base, FORGE_V1, 'the engine called the deployed server');
    assert.equal(r.engine.endpoint, FORGE_V1);
    assert.equal(r.engine.model, 'llama3.1');
    assert.equal(r.engine.model_source, 'engine default');
    const text = formatTranslateResult(r);
    assert.match(text, /Engine: local · model llama3\.1 \(engine default\) · endpoint http:\/\/127\.0\.0\.1:8378\/v1/);
  });

  it('without base_url, the answer names the endpoint that DID run (the Ollama default here)', async () => {
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'crk', method: 'local', useTm: false },
      { champollion: mockWithEngines(), env: {} });
    assert.equal(r.engine.endpoint, 'http://localhost:11434/v1');
  });

  it('method "api" + endpoint: the champollion API transport is pointed there; a loopback server needs no key', async () => {
    const champ = mockWithEngines();
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'crk', method: 'api', endpoint: FORGE_API, useTm: false },
      { champollion: champ, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(champ.engineCalls[0].endpoint, FORGE_API);
    assert.equal(champ.engineCalls[0].options.apiKey, 'not-needed', 'placeholder bearer, like the local engine');
    assert.equal(r.engine.endpoint, FORGE_API);
    assert.equal(r.engine.model_source, 'endpoint');
    assert.match(formatTranslateResult(r), /Engine: api · model chosen by the endpoint · endpoint http:\/\/127\.0\.0\.1:8378\/translate/);
  });

  it('method "api" at a remote endpoint needs CHAMPOLLION_API_KEY — and uses it when set', async () => {
    const champ = mockWithEngines();
    const remote = 'https://translate.example.org/translate';
    const refused = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'crk', method: 'api', endpoint: remote },
      { champollion: champ, env: {} });
    assert.equal(refused.status, 'needs-key');
    assert.match(refused.note, /CHAMPOLLION_API_KEY/);
    assert.equal(champ.engineCalls.length, 0);
    const ok = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'crk', method: 'api', endpoint: remote, useTm: false },
      { champollion: champ, env: { CHAMPOLLION_API_KEY: 'k-123' } });
    assert.equal(ok.status, 'ok');
    assert.equal(champ.engineCalls[0].options.apiKey, 'k-123');
    assert.equal(ok.engine.key, 'CHAMPOLLION_API_KEY');
  });

  it('refuses — never drops — a target the engine would not use', async () => {
    const champ = mockWithEngines();
    const cases = [
      [{ method: 'local', endpoint: FORGE_API }, /endpoint applies to method "api"/],
      [{ method: 'api' }, /method "api" needs endpoint/],
      [{ method: 'deepl', baseUrl: FORGE_V1 }, /base_url applies to method "local" or "openai"/],
      [{ method: 'api', endpoint: FORGE_API, baseUrl: FORGE_V1 }, /method "api" takes endpoint/],
      [{ method: 'local', baseUrl: 'ftp://x/v1' }, /http\(s\)/],
      [{ method: 'local', baseUrl: 'not a url' }, /not a URL/],
      [{ method: 'api', endpoint: 'http://user:secret@127.0.0.1:8378/translate' }, /must not carry credentials/],
      [{ method: 'deepl', model: 'x' }, /no model to choose/],
    ];
    for (const [extra, re] of cases) {
      const r = await translateTexts(
        { texts: ['hello'], source: 'en', target: 'fr', ...extra },
        { champollion: champ, env: { DEEPL_API_KEY: 'd' } });
      assert.equal(r.status, 'bad-request', JSON.stringify(extra));
      assert.match(r.note, re, JSON.stringify(extra));
    }
    assert.equal(champ.engineCalls.length, 0, 'nothing was sent anywhere');
  });

  it('a champollion that cannot take base_url is refused, not run on its default', async () => {
    const champ = mockWithEngines();
    const getMethod = champ.getMethod;
    champ.getMethod = (m, pc) => { const e = getMethod(m, pc); delete e._resolveApiBase; return e; };
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'crk', method: 'local', baseUrl: FORGE_V1 },
      { champollion: champ, env: {} });
    assert.equal(r.status, 'unavailable');
    assert.match(r.note, /nothing was sent/);
    assert.equal(champ.engineCalls.length, 0);
  });

  it('the TM is keyed on the endpoint: your model never gets Ollama\'s cached output', async () => {
    const champ = mockWithEngines();
    await translateTexts(
      { texts: ['hello'], source: 'en', target: 'crk', method: 'local' },
      { champollion: champ, env: {} });
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'crk', method: 'local', baseUrl: FORGE_V1 },
      { champollion: champ, env: {} });
    assert.equal(r.counts.tm_hits, 0, 'a different server is a cache miss');
    assert.equal(champ.engineCalls.length, 2);
    const again = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'crk', method: 'local', baseUrl: FORGE_V1 },
      { champollion: champ, env: {} });
    assert.equal(again.counts.tm_hits, 1, 'the same server hits its own entries');
  });
});

describe('translate — where the Translation Memory lives', () => {
  let STATE;
  let PROJECT;
  before(() => {
    STATE = mkdtempSync(join(tmpdir(), 'mcp-tm-'));
    PROJECT = mkdtempSync(join(tmpdir(), 'mcp-project-'));
  });
  after(() => {
    rmSync(STATE, { recursive: true, force: true });
    rmSync(PROJECT, { recursive: true, force: true });
  });

  it('by default it is the server\'s own TM, and the answer names the file', async () => {
    const prev = process.env.CHAMPOLLION_MCP_HOME;
    process.env.CHAMPOLLION_MCP_HOME = STATE;
    try {
      const champ = mockWithEngines();
      const r = await translateTexts({ texts: ['hello'], source: 'en', target: 'fr' }, { champollion: champ, env: ENV });
      assert.equal(champ.tmRoots[0], STATE);
      assert.equal(r.translation_memory.path, join(STATE, '.champollion', 'tm.json'));
      assert.equal(r.translation_memory.scope, 'mcp-server');
      assert.match(formatTranslateResult(r), /separate from any project's \.champollion\/tm\.json/);
    } finally {
      if (prev === undefined) delete process.env.CHAMPOLLION_MCP_HOME; else process.env.CHAMPOLLION_MCP_HOME = prev;
    }
  });

  it('project_dir uses that project\'s .champollion/tm.json and runs the engine there (coaching, .env)', async () => {
    const champ = mockWithEngines();
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'crk', method: 'local', projectDir: PROJECT },
      { champollion: champ, env: {} });
    assert.equal(champ.tmRoots[0], PROJECT);
    assert.equal(champ.engineCalls[0].options.cwd, PROJECT);
    assert.equal(r.translation_memory.scope, 'project');
    assert.match(formatTranslateResult(r), /shared with `champollion sync` there/);
  });

  it('project_dir reads a key from the project\'s .env, as the CLI does there', async () => {
    const champ = mockWithEngines();
    champ.getEnvOrFileVar = (name, cwd) => (cwd === PROJECT && name === 'DEEPL_API_KEY' ? 'from-dotenv' : null);
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'fr', method: 'deepl', projectDir: PROJECT, useTm: false },
      { champollion: champ, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(champ.engineCalls[0].options.apiKey, 'from-dotenv');
  });

  it('a project_dir that is not a directory is refused', async () => {
    const file = join(PROJECT, 'a-file.txt');
    writeFileSyncT(file, 'x');
    for (const p of [file, join(PROJECT, 'missing')]) {
      const r = await translateTexts(
        { texts: ['hello'], source: 'en', target: 'fr', projectDir: p },
        { champollion: mockWithEngines(), env: ENV });
      assert.equal(r.status, 'bad-request');
      assert.match(r.note, /project_dir is not a directory/);
    }
  });
});

describe('translate — what the engine says reaches the agent, never stdout', () => {
  it('an engine failure comes back with the engine\'s own reason', async () => {
    const champ = mockWithEngines({ engineFails: 'API method: Unauthorized — missing or wrong bearer token' });
    const r = await translateTexts(
      { texts: ['hello'], source: 'en', target: 'crk', method: 'api', endpoint: FORGE_API, useTm: false },
      { champollion: champ, env: {} });
    assert.equal(r.results[0].translation, null);
    assert.match(r.results[0].failure, /Unauthorized — missing or wrong bearer token/);
    assert.ok(r.engine_log.some((l) => /✓ batch started/.test(l)), 'stdout-level lines are captured too');
    assert.match(formatTranslateResult(r), /The engine said:/);
  });

  it('under stdio, engine progress lines never touch stdout (the JSON-RPC channel)', () => {
    // A separate process: whatever reaches its stdout is what an MCP client
    // would have to parse. Only the final marker may appear there.
    const mod = pathToFileURL(join(__dirname, '../src/tools/translate.js')).href;
    const script = `
      import { translateTexts } from ${JSON.stringify(mod)};
      const champ = {
        resolveCode: (c) => c,
        getMethod: () => ({
          async translate(keys, sf) {
            console.log('[INFO] ✓ API batch 1 (1/1 keys)');
            console.info('info line');
            process.stdout.write('  ✓ DeepL batch 1 (1 keys, 5 chars)');
            console.error('[WARN] something');
            return Object.fromEntries(keys.map((k) => [k, 'XL']));
          },
        }),
        translateBatch: async () => ({}),
      };
      const r = await translateTexts({ texts: ['hello'], source: 'en', target: 'fr', method: 'local', useTm: false, validate: false }, { champollion: champ, env: {} });
      process.stdout.write('RESULT ' + JSON.stringify({ status: r.status, log: r.engine_log }) + '\\n');
    `;
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    });
    const lines = out.split('\n').filter(Boolean);
    assert.equal(lines.length, 1, `stdout carried more than the result: ${JSON.stringify(out)}`);
    const r = JSON.parse(lines[0].slice('RESULT '.length));
    assert.equal(r.status, 'ok');
    assert.ok(r.log.some((l) => /API batch 1/.test(l)));
    assert.ok(r.log.some((l) => /DeepL batch 1/.test(l)));
  });
});

// ================================================================
// End to end with the REAL champollion engine: method "api" against a stub
// that speaks `nmt-forge serve`'s POST /translate contract on loopback. No
// network beyond 127.0.0.1. Proves the request reaches the endpoint the agent
// named — the exact thing the stripped `endpoint` argument once failed to do.
// ================================================================
import { createServer as createHttpServer } from 'node:http';
import { loadChampollion } from '../src/tools/translate.js';

describe('translate — real api engine → a served model on loopback', () => {
  let server;
  let url;
  const seen = [];
  before(async () => {
    server = createHttpServer((req, res) => {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', () => {
        seen.push({ path: req.url, auth: req.headers.authorization, body: JSON.parse(body || '{}') });
        if (req.url !== '/translate') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: `no route ${req.url}` } }));
          return;
        }
        const { keys } = JSON.parse(body);
        const translations = Object.fromEntries(Object.keys(keys).map((k) => [k, `bonjour ${k}`]));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ translations, meta: { model: 'forge-test', method: 'nmt-forge' } }));
      });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${server.address().port}/translate`;
  });
  after(() => new Promise((r) => server.close(r)));

  it('the texts go to the named endpoint and come back, named in the answer', async (t) => {
    const champollion = await loadChampollion();
    if (!champollion?.getMethod) {
      t.skip('the champollion package is not reachable here');
      return;
    }
    const r = await translateTexts(
      { texts: ['hello', 'good morning'], source: 'en', target: 'fr', method: 'api', endpoint: url, useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(seen.length, 1, 'exactly one request, to the stub');
    assert.equal(seen[0].path, '/translate');
    // The CLI's api method chooses its own bearer (never another provider's
    // key): on loopback with no CHAMPOLLION_API_KEY, a placeholder.
    assert.equal(seen[0].auth, 'Bearer local-no-token', 'loopback: placeholder bearer, no key required');
    assert.deepEqual(Object.values(seen[0].body.keys), ['hello', 'good morning']);
    assert.equal(r.counts.translated, 2);
    assert.match(r.results[0].translation, /^bonjour/);
    assert.equal(r.engine.endpoint, url);
    assert.match(formatTranslateResult(r), new RegExp(`endpoint ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  });

  it('a model served on this machine is priced in the CLI\'s words, never "0 USD" (Round 9, Next.js persona)', async (t) => {
    const champollion = await loadChampollion();
    if (!champollion?.getMethod || typeof champollion.costLabel !== 'function') {
      t.skip('the champollion package (with costLabel) is not reachable here');
      return;
    }
    const r = await translateTexts(
      { texts: ['thank you'], source: 'en', target: 'fr', method: 'api', endpoint: url, useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.estimated_api_cost.estimatedCost, 0);
    assert.equal(r.estimated_api_cost_label, champollion.costLabel(r.estimated_api_cost), 'the shared helper\'s label');
    const text = formatTranslateResult(r);
    assert.match(text, /^Cost of the fresh calls: \$0 API cost \(runs on this machine\)\.$/m);
    assert.doesNotMatch(text, /0 USD/);
  });
});

// ================================================================
// project_dir shares sync's cache — exactly (synthetic i18next persona,
// 2026-10: 0 of 2 hits on strings `champollion sync` had just cached with
// the same method, model and register). The tool keyed the entries itself:
// the resolved code "fra" for the project's "fr", a hashed register text for
// the card preset "formal-vous", an endpoint suffix sync never adds. With
// project_dir it now resolves the pair through the CLI's own config + pair
// code. Proven end to end: the REAL `champollion sync` caches through a
// stub OpenAI-compatible server on loopback, then the tool is asked.
// ================================================================
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { translateResultIsError } from '../src/tools/translate.js';

const CLI_BIN = resolve(__dirname, '../../cli/bin/cli.js');

/** A stub OpenAI-compatible server: answers from a fixed dictionary, counts requests. */
async function startStubChatServer(dictionary) {
  const requests = [];
  const server = createHttpServer((req, res) => {
    // The CLI asks a local model server whether it answers (GET <base>/models)
    // before it translates; that readiness check is not a translation request.
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: [] }));
      return;
    }
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      requests.push(req.url);
      const parsed = JSON.parse(body || '{}');
      const user = [...(parsed.messages || [])].reverse().find((m) => m.role === 'user')?.content || '';
      const keys = JSON.parse(user.slice(user.indexOf('{\n')));
      const out = Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, dictionary[v] ?? `?${v}`]));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(out) } }] }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, requests, url: `http://127.0.0.1:${server.address().port}/v1` };
}

describe('translate — project_dir hits what `champollion sync` cached there', () => {
  const FR = { 'Save changes': 'Enregistrer les modifications', 'Delete account': 'Supprimer le compte' };
  let stub;
  let PROJ;
  before(async () => {
    stub = await startStubChatServer(FR);
    PROJ = mkdtempSync(join(tmpdir(), 'mcp-sync-tm-'));
  });
  after(async () => {
    await new Promise((r) => stub.server.close(r));
    rmSync(PROJ, { recursive: true, force: true });
  });

  it('sync-cached strings are TM hits for translate with the same project, method and model', async (t) => {
    const champollion = await loadChampollion();
    if (!champollion?.resolvePairs || !existsSync(CLI_BIN)) {
      t.skip('the champollion CLI is not reachable here');
      return;
    }
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(join(PROJ, 'locales'));
    writeFileSync(join(PROJ, 'locales', 'en.json'), JSON.stringify({ save: 'Save changes', remove: 'Delete account' }));
    writeFileSync(join(PROJ, 'champollion.config.json'), JSON.stringify({
      inputLocale: 'en', localesDir: 'locales', languages: ['fr'], defaultMethod: 'local', model: 'stub-1',
    }));
    // The real CLI, as the user ran it (async: the stub answers from this process).
    await promisify(execFile)(process.execPath, [CLI_BIN, 'sync'], {
      cwd: PROJ, env: { ...process.env, LOCAL_API_BASE: stub.url, CHAMPOLLION_NO_UPDATE_CHECK: '1' },
    });
    assert.deepEqual(JSON.parse(readFileSync(join(PROJ, 'locales', 'fr.json'), 'utf-8')),
      { save: FR['Save changes'], remove: FR['Delete account'] }, 'sync translated through the stub');
    const syncRequests = stub.requests.length;
    assert.ok(syncRequests >= 1);

    const r = await translateTexts(
      { texts: ['Save changes', 'Delete account'], source: 'en', target: 'fr', method: 'local', model: 'stub-1', projectDir: PROJ },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.counts.tm_hits, 2, `both strings come from the cache sync filled (key ${r.translation_memory.key})`);
    assert.deepEqual(r.results.map((x) => x.translation), [FR['Save changes'], FR['Delete account']]);
    assert.equal(stub.requests.length, syncRequests, 'no request reached the server');
    // Exactly the CLI's key and locale for the project's pair.
    const pc = champollion.resolvePairs(champollion.resolveConfig({ method: 'local', model: 'stub-1' }, PROJ)).get('en:fr');
    assert.equal(r.translation_memory.key, champollion.tmMethodKey(pc));
    assert.equal(r.translation_memory.locale, 'fr');
    assert.equal(r.translation_memory.project_pair, 'en:fr');
    assert.match(formatTranslateResult(r), /pair en:fr, the same cache key/);

    // And the other way: what translate caches there, sync serves for free.
    const r2 = await translateTexts(
      { texts: ['Delete account'], source: 'en', target: 'fr', method: 'local', model: 'stub-1', projectDir: PROJ },
      { champollion, env: {} });
    assert.equal(r2.counts.tm_hits, 1);
  });
});

// ================================================================
// Writing system: the tool refuses to pick an orthography for a community,
// exactly where `champollion sync` refuses (synthetic Cree school persona,
// 2026-10: translate wrote crk in an unchosen script while sync refused).
// ================================================================
describe('translate — a target with two real orthographies needs a script choice', () => {
  const CRK = { Hello: 'tânisi' };
  let stub;
  before(async () => { stub = await startStubChatServer(CRK); });
  after(() => new Promise((r) => stub.server.close(r)));

  it('no script: refused, with the choices named; nothing is sent', async (t) => {
    const champollion = await loadChampollion();
    if (!champollion?.resolveTargetScript) { t.skip('this champollion has no script decision'); return; }
    const before = stub.requests.length;
    const r = await translateTexts(
      { texts: ['Hello'], source: 'en', target: 'crk', method: 'local', baseUrl: stub.url, useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'bad-request');
    assert.match(r.note, /more than one real orthography/);
    assert.match(r.note, /script: "Latn"/);
    assert.match(r.note, /script: "Cans"/);
    assert.equal(stub.requests.length, before);
  });

  it('script "Cans": translated in the working script, delivered in Syllabics; "Latn" as written', async (t) => {
    const champollion = await loadChampollion();
    if (!champollion?.resolveTargetScript) { t.skip('this champollion has no script decision'); return; }
    const cans = await translateTexts(
      { texts: ['Hello'], source: 'en', target: 'crk', method: 'local', baseUrl: stub.url, script: 'Cans', useTm: false },
      { champollion, env: {} });
    assert.equal(cans.status, 'ok', cans.note);
    assert.equal(cans.results[0].translation, champollion.convertScript('tânisi', 'crk').converted);
    assert.match(cans.results[0].translation, /^[᐀-ᙿ]+$/u, 'Unified Canadian Aboriginal Syllabics');
    assert.equal(cans.script.converted, true);
    const latn = await translateTexts(
      { texts: ['Hello'], source: 'en', target: 'crk', method: 'local', baseUrl: stub.url, script: 'Latn', useTm: false },
      { champollion, env: {} });
    assert.equal(latn.results[0].translation, 'tânisi');
  });

  it('with project_dir, the pair\'s configured script is used; without one, the refusal names the config file', async (t) => {
    const champollion = await loadChampollion();
    if (!champollion?.resolveTargetScript || !champollion?.resolvePairs) { t.skip('older champollion'); return; }
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const proj = mkdtempSync(join(tmpdir(), 'mcp-crk-'));
    try {
      mkdirSync(join(proj, 'locales'));
      writeFileSync(join(proj, 'locales', 'en.json'), '{"hi":"Hello"}');
      writeFileSync(join(proj, 'champollion.config.json'), JSON.stringify({ inputLocale: 'en', localesDir: 'locales', languages: ['crk'] }));
      const refused = await translateTexts(
        { texts: ['Hello'], source: 'en', target: 'crk', method: 'local', baseUrl: stub.url, projectDir: proj, useTm: false },
        { champollion, env: {} });
      assert.equal(refused.status, 'bad-request');
      assert.match(refused.note, /champollion\.config\.json/);
      writeFileSync(join(proj, 'champollion.config.json'), JSON.stringify({
        inputLocale: 'en', localesDir: 'locales', languages: ['crk'], pairs: { 'en:crk': { script: 'Cans' } },
      }));
      const r = await translateTexts(
        { texts: ['Hello'], source: 'en', target: 'crk', method: 'local', baseUrl: stub.url, projectDir: proj, useTm: false },
        { champollion, env: {} });
      assert.equal(r.status, 'ok', r.note);
      assert.match(r.results[0].translation, /^[᐀-ᙿ]+$/u);
    } finally {
      rmSync(proj, { recursive: true, force: true });
    }
  });
});

// ================================================================
// isError when nothing was translated (the i18next persona pointed the tool
// at a dead port: 0 of 2, and the call was reported as a success).
// ================================================================
describe('translate — every text failing is a tool error; a partial result is not', () => {
  it('an unreachable engine: isError, and the answer says nothing was translated', async (t) => {
    const champollion = await loadChampollion();
    if (!champollion?.getMethod) { t.skip('the champollion package is not reachable here'); return; }
    const { createServer: netServer } = await import('node:net');
    const probe = netServer();
    await new Promise((r) => probe.listen(0, '127.0.0.1', r));
    const dead = `http://127.0.0.1:${probe.address().port}/v1`;
    await new Promise((r) => probe.close(r));
    const realSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn, ms, ...rest) => realSetTimeout(fn, ms > 500 && ms < 20000 ? 0 : ms, ...rest); // skip back-off sleeps, keep the request timeout
    let r;
    try {
      r = await translateTexts(
        { texts: ['Hello', 'Goodbye'], source: 'en', target: 'fr', method: 'local', baseUrl: dead, useTm: false },
        { champollion, env: {} });
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
    assert.equal(r.status, 'ok');
    assert.equal(r.counts.translated + r.counts.tm_hits, 0);
    assert.equal(translateResultIsError(r), true);
    const text = formatTranslateResult(r);
    assert.match(text, /^Nothing was translated: all 2 text\(s\) failed/);
    assert.ok(text.includes(dead), 'the failure names the address it tried');
  });

  it('a partial result is a normal answer that lists its failures', async () => {
    const mock = mockChampollion({ failTexts: ['bad'] });
    const r = await translateTexts({ texts: ['good', 'bad'], source: 'en', target: 'fr' }, { champollion: mock, env: ENV });
    assert.equal(r.counts.translated, 1);
    assert.equal(translateResultIsError(r), false);
    assert.match(formatTranslateResult(r), /FAILED: length inflation/);
    assert.equal(translateResultIsError({ status: 'bad-request', note: 'x' }), true);
  });
});

// ================================================================
// project_dir with no method runs the PROJECT's method and model (synthetic
// Django persona, 2026-10: the tool's own "llm" default refused for want of
// an OpenRouter key in a project configured `defaultMethod: "local"`), and
// the answer speaks in the project's codes, with no Script line for a
// one-script target (synthetic Next.js persona, 2026-10: "eng → fra" for a
// project written in fr/de, and "Script: the working script (none)").
// Real champollion, a fake OpenAI-compatible model on loopback; no key.
// ================================================================
import { mkdirSync as mkdirSyncP } from 'node:fs';

const FAKE_MODEL = resolve(__dirname, '../../cli/test/fixtures/fake-openai-model.mjs');

describe('translate — project_dir brings the project\'s method, model and codes', () => {
  const DICT = { 'Save changes': 'Enregistrer les modifications', Hello: 'tânisi' };
  let fake;
  let PROJ;
  const saved = {};
  before(async () => {
    if (!existsSync(FAKE_MODEL)) return;
    const { startFakeModel } = await import(pathToFileURL(FAKE_MODEL).href);
    fake = await startFakeModel((key, source) => DICT[source] ?? `?${source}`);
    PROJ = mkdtempSync(join(tmpdir(), 'mcp-proj-method-'));
    mkdirSyncP(join(PROJ, 'messages'));
    writeFileSyncT(join(PROJ, 'messages', 'en.json'), JSON.stringify({ save: 'Save changes' }));
    // The engine reads its endpoint from the process environment; and an
    // exported OpenRouter key must never turn a regression here into a billed call.
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
  const writeConfig = (cfg) => writeFileSyncT(join(PROJ, 'champollion.config.json'),
    JSON.stringify({ inputLocale: 'en', localesDir: 'messages', ...cfg }));
  async function ready(t) {
    const champollion = await loadChampollion();
    if (!fake || !champollion?.resolvePairs) { t.skip('the champollion CLI is not reachable here'); return null; }
    return champollion;
  }

  it('no method: the project\'s defaultMethod "local" runs with its model — no OpenRouter key needed', async (t) => {
    const champollion = await ready(t);
    if (!champollion) return;
    writeConfig({ languages: ['fr', 'de'], defaultMethod: 'local', model: 'stub-1' });
    const sent = fake.calls.length;
    const r = await translateTexts(
      { texts: ['Save changes'], source: 'en', target: 'fr', projectDir: PROJ, useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.method, 'local');
    assert.equal(r.engine.method_source, 'project');
    assert.equal(r.results[0].translation, DICT['Save changes']);
    assert.equal(fake.calls.length, sent + 1, 'the fake model was called');
    assert.equal(fake.calls.at(-1).model, 'stub-1', 'the project\'s model');
    assert.match(formatTranslateResult(r), /Engine: local \(the project's configured method\) · model stub-1/);
  });

  it('a per-language method/model in object-form languages is the project\'s choice for that target', async (t) => {
    const champollion = await ready(t);
    if (!champollion) return;
    writeConfig({ languages: { fr: { method: 'local', model: 'm-fr' }, de: {} } });
    const r = await translateTexts(
      { texts: ['Save changes'], source: 'en', target: 'fr', projectDir: PROJ, useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.method, 'local');
    assert.equal(fake.calls.at(-1).model, 'm-fr');
  });

  it('a stated method still overrides the project\'s', async (t) => {
    const champollion = await ready(t);
    if (!champollion) return;
    writeConfig({ languages: ['fr'], defaultMethod: 'llm' });
    const refused = await translateTexts(
      { texts: ['Save changes'], source: 'en', target: 'fr', projectDir: PROJ, useTm: false },
      { champollion, env: {} });
    assert.equal(refused.status, 'needs-key', 'the project says llm, and there is no OpenRouter key');
    assert.match(refused.note, /OPENROUTER_API_KEY/);
    const sent = fake.calls.length;
    const r = await translateTexts(
      { texts: ['Save changes'], source: 'en', target: 'fr', projectDir: PROJ, method: 'local', useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.method, 'local');
    assert.equal(r.engine.method_source, 'requested');
    assert.equal(fake.calls.length, sent + 1);
  });

  it('the header uses the project\'s codes, and a one-script target has no Script line', async (t) => {
    const champollion = await ready(t);
    if (!champollion) return;
    writeConfig({ languages: ['fr', 'de'], defaultMethod: 'local' });
    const r = await translateTexts(
      { texts: ['Save changes'], source: 'en', target: 'fr', projectDir: PROJ, method: 'local', useTm: false },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.deepEqual(r.codes, { source: 'en', target: 'fr' });
    const text = formatTranslateResult(r);
    const resolvedFr = champollion.resolveCode('fr');
    const suffix = resolvedFr && resolvedFr !== 'fr' ? ` (${resolvedFr})` : '';
    assert.ok(text.startsWith(`Translated en → fr${suffix} via local`), text.split('\n')[0]);
    assert.doesNotMatch(text, /^Script:/m, 'fr has one writing system — nothing to report');
    // A real choice keeps its line: crk delivered in Syllabics.
    const crk = await translateTexts(
      { texts: ['Hello'], source: 'en', target: 'crk', method: 'local', script: 'Cans', useTm: false },
      { champollion, env: {} });
    assert.equal(crk.status, 'ok', crk.note);
    assert.match(formatTranslateResult(crk), /^Script: .*script Cans/m);
    // Without project_dir, the codes are the caller's.
    const plain = await translateTexts(
      { texts: ['Save changes'], source: 'en', target: 'fr', method: 'local', useTm: false },
      { champollion, env: {} });
    assert.ok(formatTranslateResult(plain).startsWith(`Translated en → fr${suffix} via local`));
  });
});


// ================================================================
// One memorized sentence for three different texts (synthetic hospital
// persona, 2026-10): the tool validated each text alone, returned all three
// as validated and cached them — and the next `champollion sync` wrote them.
// The shared-output rule (cli/lib/validate.js) holds within a call.
// ================================================================
describe('translate — one sentence for 3+ different texts is refused within a call, never cached', () => {
  const S = 'Pemâmitonêyihtamân ê-wî-kiskêyihtamân anohc kîsikâw';
  const TEXTS = ['Where does it hurt?', 'We will call your family.', "Take your medicine at 8 o'clock.", 'Ward Helper'];
  let fake;
  let PROJ;
  const saved = {};
  before(async () => {
    if (!existsSync(FAKE_MODEL)) return;
    const { startFakeModel } = await import(pathToFileURL(FAKE_MODEL).href);
    fake = await startFakeModel((key, source) => (source === 'Ward Helper' ? 'Ospital 11' : S));
    PROJ = mkdtempSync(join(tmpdir(), 'mcp-shared-'));
    mkdirSyncP(join(PROJ, 'messages'));
    writeFileSyncT(join(PROJ, 'messages', 'en.json'), JSON.stringify({ a: 'Ward Helper' }));
    writeFileSyncT(join(PROJ, 'champollion.config.json'),
      JSON.stringify({ inputLocale: 'en', localesDir: 'messages', languages: ['abc'], defaultMethod: 'local', model: 'stub-1' }));
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

  it('the three are refused with the reason; the distinct one is kept; nothing shared reaches the cache', async (t) => {
    const champollion = await loadChampollion();
    if (!fake || !champollion?.SharedOutputIndex) { t.skip('the champollion CLI is not reachable here'); return; }
    const r = await translateTexts(
      { texts: TEXTS, source: 'en', target: 'abc', projectDir: PROJ },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    const shared = r.results.filter((x) => x.source !== 'Ward Helper');
    for (const x of shared) {
      assert.equal(x.validated, false);
      assert.equal(x.translation, null);
      assert.match(x.failure, /same output for 3 different source strings/);
    }
    assert.equal(r.results.find((x) => x.source === 'Ward Helper').translation, 'Ospital 11');
    const tmFile = join(PROJ, '.champollion', 'tm.json');
    const cached = existsSync(tmFile) ? JSON.parse(readFileSync(tmFile, 'utf8')) : {};
    assert.ok(!Object.values(cached).some((e) => e && e.t === S), 'the shared sentence was not cached');
  });
});

// ================================================================
// Language NAMES with project_dir (Round 7, Next.js persona): "English" /
// "French" did not match the project's en:fr pair — the tool said the
// project had no pair, ran the engine's default model, missed both entries
// sync had cached (a hosted model would re-bill them) and cached two
// entries under a locale literally named "French". Names (and other codes
// for the same language) now become the project's own locale code before
// the pair is matched and before the cache is read or written.
// ================================================================
describe('translate — language names resolve to the project\'s own locale codes', () => {
  const DICT = { 'Save changes': 'Enregistrer les modifications', 'Delete account': 'Supprimer le compte' };
  let fake;
  let PROJ;
  const saved = {};
  before(async () => {
    if (!existsSync(FAKE_MODEL) || !existsSync(CLI_BIN)) return;
    const { startFakeModel } = await import(pathToFileURL(FAKE_MODEL).href);
    fake = await startFakeModel((key, source) => DICT[source] ?? `?${source}`);
    // The engine in this process reads its endpoint from the environment;
    // an exported OpenRouter key must never turn a regression into a billed call.
    for (const k of ['LOCAL_API_BASE', 'OPENROUTER_API_KEY']) saved[k] = process.env[k];
    process.env.LOCAL_API_BASE = fake.url;
    delete process.env.OPENROUTER_API_KEY;
    PROJ = mkdtempSync(join(tmpdir(), 'mcp-names-'));
    mkdirSyncP(join(PROJ, 'messages'));
    writeFileSyncT(join(PROJ, 'messages', 'en.json'), JSON.stringify({ save: 'Save changes', remove: 'Delete account' }));
    writeFileSyncT(join(PROJ, 'champollion.config.json'), JSON.stringify({
      inputLocale: 'en', localesDir: 'messages', languages: ['fr'], defaultMethod: 'local', model: 'stub-1',
    }));
    await promisify(execFile)(process.execPath, [CLI_BIN, 'sync'], {
      cwd: PROJ, env: { ...process.env, LOCAL_API_BASE: fake.url, CHAMPOLLION_NO_UPDATE_CHECK: '1', OPENROUTER_API_KEY: '' },
    });
  });
  after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    await fake?.close();
    if (PROJ) rmSync(PROJ, { recursive: true, force: true });
  });
  const tmLocales = () => {
    const tm = JSON.parse(readFileSync(join(PROJ, '.champollion', 'tm.json'), 'utf8'));
    return new Set(Object.entries(tm).filter(([k]) => k !== '_meta').map(([, e]) => e.l));
  };

  for (const [label, source, target] of [
    ['names', 'English', 'French'],
    ['codes', 'en', 'fr'],
    ['mixed', 'English', 'fr'],
    ['another code for the same language', 'eng', 'fra'],
  ]) {
    it(`${label} (${source} → ${target}): the project's pair, its model, sync's cache — nothing sent, no stray locale`, async (t) => {
      const champollion = await loadChampollion();
      if (!fake || !champollion?.resolveLanguageInput) { t.skip('the champollion CLI is not reachable here'); return; }
      const sent = fake.calls.length;
      const r = await translateTexts(
        { texts: ['Save changes', 'Delete account'], source, target, projectDir: PROJ },
        { champollion, env: {} });
      assert.equal(r.status, 'ok', r.note);
      assert.deepEqual(r.codes, { source: 'en', target: 'fr' }, 'the project\'s own codes');
      assert.equal(r.translation_memory.project_pair, 'en:fr', 'the project\'s pair');
      assert.equal(r.translation_memory.locale, 'fr');
      assert.equal(r.method, 'local');
      assert.equal(r.engine.model, 'stub-1', 'the project\'s model, not the engine default');
      assert.equal(r.counts.tm_hits, 2, 'both served from the cache sync filled');
      assert.equal(fake.calls.length, sent, 'nothing was sent');
      assert.deepEqual([...tmLocales()], ['fr'], 'no entry under a display name');
      const text = formatTranslateResult(r);
      assert.match(text, /pair en:fr, the same cache key/);
      if (source !== 'en' || target !== 'fr') {
        assert.match(text, new RegExp(`Languages: .*"${target === 'fr' ? source : target}" → ${target === 'fr' ? 'en' : 'fr'}`));
      } else {
        assert.doesNotMatch(text, /^Languages:/m, 'codes as written: nothing to report');
      }
    });
  }

  it('a new text under a name is cached under the project\'s code, never the name', async (t) => {
    const champollion = await loadChampollion();
    if (!fake || !champollion?.resolveLanguageInput) { t.skip('the champollion CLI is not reachable here'); return; }
    DICT['Sign out'] = 'Se déconnecter';
    const r = await translateTexts(
      { texts: ['Sign out'], source: 'English', target: 'French', projectDir: PROJ },
      { champollion, env: {} });
    assert.equal(r.status, 'ok', r.note);
    assert.equal(r.counts.translated, 1);
    assert.deepEqual([...tmLocales()], ['fr']);
  });

  it('a word that is no language, and a name matching two project locales, are refused — nothing sent', async (t) => {
    const champollion = await loadChampollion();
    if (!fake || !champollion?.resolveLanguageInput) { t.skip('the champollion CLI is not reachable here'); return; }
    const sent = fake.calls.length;
    const typo = await translateTexts(
      { texts: ['Save changes'], source: 'English', target: 'Frnch', projectDir: PROJ },
      { champollion, env: {} });
    assert.equal(typo.status, 'bad-request');
    assert.match(typo.note, /target_language: "Frnch" is neither a language code nor the name/);
    assert.match(typo.note, /The project's locales: en, fr/);
    const proj2 = mkdtempSync(join(tmpdir(), 'mcp-names2-'));
    try {
      mkdirSyncP(join(proj2, 'messages'));
      writeFileSyncT(join(proj2, 'messages', 'en.json'), JSON.stringify({ save: 'Save changes' }));
      writeFileSyncT(join(proj2, 'champollion.config.json'), JSON.stringify({
        inputLocale: 'en', localesDir: 'messages', languages: ['fr', 'fr-CA'], defaultMethod: 'local',
      }));
      const two = await translateTexts(
        { texts: ['Save changes'], source: 'en', target: 'French', projectDir: proj2 },
        { champollion, env: {} });
      assert.equal(two.status, 'bad-request');
      assert.match(two.note, /matches more than one of the project's locales \(fr, fr-CA\)/);
      assert.equal(existsSync(join(proj2, '.champollion', 'tm.json')), false, 'nothing cached');
    } finally {
      rmSync(proj2, { recursive: true, force: true });
    }
    assert.equal(fake.calls.length, sent);
  });

  it('without project_dir a name becomes its code, and the cache locale is the code\'s', async (t) => {
    const champollion = await loadChampollion();
    if (!fake || !champollion?.resolveLanguageInput) { t.skip('the champollion CLI is not reachable here'); return; }
    const state = mkdtempSync(join(tmpdir(), 'mcp-names-state-'));
    try {
      const byName = await translateTexts(
        { texts: ['Save changes'], source: 'English', target: 'French', method: 'local', baseUrl: fake.url, model: 'stub-1' },
        { champollion, env: {}, tmRoot: state });
      assert.equal(byName.status, 'ok', byName.note);
      assert.deepEqual(byName.codes, { source: 'en', target: 'fr' });
      const byCode = await translateTexts(
        { texts: ['Save changes'], source: 'en', target: 'fr', method: 'local', baseUrl: fake.url, model: 'stub-1' },
        { champollion, env: {}, tmRoot: state });
      assert.equal(byCode.counts.tm_hits, 1, 'the name and the code share one entry');
      assert.equal(byName.translation_memory.locale, byCode.translation_memory.locale);
    } finally {
      rmSync(state, { recursive: true, force: true });
    }
  });
});

// ================================================================
// A cached answer the shared-output check discards is said to be discarded
// (Round 8, hospital persona): the summary read "0/2 free from Translation
// Memory" and nothing else — the TM had answered, and the answer had been
// thrown out because the same sentence answered another, different source.
// The free count stays truthful (a discarded hit is not free output); the
// summary and the line for that text now say what happened.
// ================================================================
describe('translate — a cached answer discarded by the shared-output check is reported', () => {
  const S = 'Pemâmitonêyihtamân ê-wî-kiskêyihtamân anohc kîsikâw';
  const engine = (source) => (source === 'Ward Helper' ? 'Ospital 11' : S);
  /** The mock package with the CLI's REAL shared-output rule, and an engine that repeats S. */
  async function withSharedRule(mock) {
    const real = await loadChampollion();
    if (!real?.SharedOutputIndex || !real?.sharedOutputItems) return null;
    mock.SharedOutputIndex = real.SharedOutputIndex;
    mock.sharedOutputItems = real.sharedOutputItems;
    mock.sharedOutputReason = real.sharedOutputReason;
    mock.translateBatch = async (keys, sourceFlat) => Object.fromEntries(keys.map((k) => [k, engine(sourceFlat[k])]));
    return mock;
  }
  const call = (champollion, texts) => translateTexts({ texts, source: 'en', target: 'crk' }, { champollion, env: ENV });

  it('one discarded hit: the count stays truthful and the summary and the line say it was discarded', async (t) => {
    const champollion = await withSharedRule(mockChampollion());
    if (!champollion) { t.skip('the champollion CLI is not reachable here'); return; }
    await call(champollion, ['Where does it hurt?']); // caches S for this source
    const r = await call(champollion, ['Where does it hurt?', 'We will call your family.', 'Ward Helper']);
    assert.equal(r.counts.tm_hits, 0, 'a discarded hit is not free output');
    assert.equal(r.counts.tm_discarded, 1);
    assert.equal(r.counts.failed, 2);
    assert.equal(r.results[0].cached_discarded, true);
    assert.equal(r.results[0].from_tm, false);
    assert.equal(r.results[1].cached_discarded, undefined, 'the fresh answer was not a cached one');
    const text = formatTranslateResult(r);
    assert.equal(text.split('\n')[0], 'Translated en → crk via llm — 0/3 free from Translation Memory, 1 newly translated, '
      + '2 failed; 1 cached answer discarded: the same sentence answered another, different source '
      + '(the shared-output check — the lines below say which).');
    assert.match(text, /^\[0\] FAILED: cached answer discarded — same output for 2 different source strings/m);
    assert.match(text, /^\[1\] FAILED: same output for 2 different source strings/m);
    assert.match(text, /^\[2\] Ospital 11$/m);
  });

  it('two discarded hits: the count agrees with its noun', async (t) => {
    const champollion = await withSharedRule(mockChampollion());
    if (!champollion) { t.skip('the champollion CLI is not reachable here'); return; }
    // Cached one at a time: within one call the rule would have refused them.
    await call(champollion, ['Where does it hurt?']);
    await call(champollion, ['We will call your family.']);
    const r = await call(champollion, ['Where does it hurt?', 'We will call your family.', 'Ward Helper']);
    assert.deepEqual([r.counts.tm_hits, r.counts.tm_discarded, r.counts.translated], [0, 2, 1]);
    assert.match(formatTranslateResult(r).split('\n')[0],
      /; 2 cached answers discarded: each one's sentence also answered another, different source \(the shared-output check/);
  });

  it('nothing discarded: the summary is unchanged', async (t) => {
    const champollion = await withSharedRule(mockChampollion());
    if (!champollion) { t.skip('the champollion CLI is not reachable here'); return; }
    await call(champollion, ['Ward Helper']);
    const r = await call(champollion, ['Ward Helper']);
    assert.deepEqual([r.counts.tm_hits, r.counts.tm_discarded], [1, 0]);
    assert.equal(formatTranslateResult(r).split('\n')[0],
      'Translated en → crk via llm — 1/1 free from Translation Memory, 0 newly translated, 0 failed.');
  });

  it('the note names where the discarded answers came from when the fallback\'s cache is involved', () => {
    assert.equal(cachedDiscardedNote({}), '');
    assert.equal(cachedDiscardedNote({ fallback_cache_discarded: 1 }),
      '1 cached answer from the fallback\'s cache discarded: the same sentence answered another, different source '
      + '(the shared-output check — the lines below say which)');
    assert.match(cachedDiscardedNote({ tm_discarded: 1, fallback_cache_discarded: 2 }),
      /^3 cached answers \(1 from Translation Memory, 2 from the fallback's cache\) discarded: each one's sentence/);
  });
});
