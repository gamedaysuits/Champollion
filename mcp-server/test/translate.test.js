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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  translateTexts,
  formatTranslateResult,
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
    assert.ok(text.includes('(TM) bonjour'));
    assert.ok(text.includes('FAILED: length inflation'));
    assert.ok(text.includes('Nothing invalid was returned'));
  });
});
