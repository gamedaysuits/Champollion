/**
 * Integration tests for the translation method pipeline.
 *
 * These tests exercise the FULL path from the translate.js orchestrator
 * through method resolution, prompt building, and the OpenRouter client.
 *
 * WHY THESE EXIST:
 *   Unit tests cover individual pieces (prompt building, coaching loading,
 *   key validation). Integration tests verify the pieces wire together:
 *     1. translateBatch() → getMethod() → LLMMethod.translate() → callOpenRouterJSON()
 *     2. translateRawContent() → getMethod() → LLMMethod.translateContent() → callOpenRouter()
 *     3. Plugin resolution → method instantiation → correct config propagation
 *     4. Error handling across the pipeline (API failures, malformed responses, etc.)
 *
 * MOCK STRATEGY:
 *   We intercept global `fetch` to simulate OpenRouter responses without
 *   hitting the real API. This tests the actual code paths, not mocked stubs.
 *   The mock validates that correct headers, model, and temperature are sent.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

import { translateBatch, translateRawContent, getMethod, METHOD_REGISTRY } from '../lib/translate.js';
import { resolvePluginForPair, loadPlugins } from '../lib/plugins.js';

// -----------------------------------------------------------------
// Mock infrastructure — intercept global fetch
// -----------------------------------------------------------------

/**
 * Create a mock fetch function that returns controlled OpenRouter responses.
 *
 * @param {object} options
 * @param {object} [options.jsonPayload] - JSON to return as the model's content
 * @param {string} [options.textPayload] - Raw text to return as the model's content
 * @param {number} [options.status=200] - HTTP status code
 * @param {function} [options.requestValidator] - Callback to inspect the request
 * @param {number} [options.failCount=0] - Number of times to return 429 before succeeding
 * @returns {{ mockFetch: function, calls: object[] }}
 */
function createMockFetch({
  jsonPayload = null,
  textPayload = null,
  status = 200,
  requestValidator = null,
  failCount = 0,
} = {}) {
  const calls = [];
  let callIndex = 0;

  const content = jsonPayload
    ? JSON.stringify(jsonPayload)
    : (textPayload || '');

  async function mockFetch(url, options) {
    const body = JSON.parse(options.body);
    calls.push({ url, options, body });

    if (requestValidator) {
      requestValidator({ url, options, body });
    }

    // Simulate transient failures for retry testing
    if (callIndex < failCount) {
      callIndex++;
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: 'rate limited' }),
      };
    }

    callIndex++;

    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({
        choices: [{
          message: {
            content,
          },
        }],
      }),
    };
  }

  return { mockFetch, calls };
}

/**
 * Install a mock fetch and restore the real one after the callback runs.
 *
 * Uses a simple global override — node:test doesn't have a built-in
 * mock for globals, and we want to avoid adding test framework deps.
 */
function withMockFetch(mockFn, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFn;
  try {
    return callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-integration-'));
}

function cleanupDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Suppress console.error noise from retry/error logging during tests
const originalError = console.error;
function muteConsole() { console.error = () => {}; }
function restoreConsole() { console.error = originalError; }

// =================================================================
// translateBatch — v3 pipeline (method-based)
// =================================================================

describe('integration: translateBatch v3 pipeline', () => {
  beforeEach(muteConsole);
  afterEach(restoreConsole);

  it('routes through LLMMethod and returns translated keys', async () => {
    const { mockFetch, calls } = createMockFetch({
      jsonPayload: { 'hero.title': 'Bienvenue', 'hero.subtitle': 'Commencer' },
    });

    const result = await withMockFetch(mockFetch, () =>
      translateBatch(
        ['hero.title', 'hero.subtitle'],
        { 'hero.title': 'Welcome', 'hero.subtitle': 'Get started' },
        { method: 'llm', model: 'google/gemini-3.5-flash', name: 'French', register: 'Formal' },
        { apiKey: 'test-key-123' },
      ),
    );

    assert.ok(result, 'Should return translated keys');
    assert.equal(result['hero.title'], 'Bienvenue');
    assert.equal(result['hero.subtitle'], 'Commencer');

    // Verify the correct URL and headers were sent
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.includes('openrouter.ai'));
    assert.ok(calls[0].options.headers['Authorization'].includes('test-key-123'));
    assert.equal(calls[0].body.model, 'google/gemini-3.5-flash');
  });

  it('routes through LLMCoachedMethod for method "llm-coached"', async () => {
    const { mockFetch, calls } = createMockFetch({
      jsonPayload: { 'nav.home': 'Accueil' },
    });

    const result = await withMockFetch(mockFetch, () =>
      translateBatch(
        ['nav.home'],
        { 'nav.home': 'Home' },
        {
          method: 'llm-coached',
          model: 'google/gemini-3.5-flash',
          name: 'French',
          register: 'Formal',
          target: 'fr',
        },
        {
          apiKey: 'test-key-coached',
          // No coaching data dir → falls back to plain LLM
          cwd: os.tmpdir(),
        },
      ),
    );

    // Should still produce output even without coaching data (falls back)
    assert.ok(result);
    assert.equal(result['nav.home'], 'Accueil');
  });

  it('returns null when no API key is provided', async () => {
    const result = await translateBatch(
      ['test.key'],
      { 'test.key': 'Hello' },
      { method: 'llm', name: 'French', register: 'Standard' },
      { apiKey: null },
    );

    assert.equal(result, null);
  });

  it('filters out prototype-pollution keys from API response', async () => {
    // The mock API "returns" unsafe keys alongside safe ones.
    // isUnsafeKey checks dot-segments, so 'obj.__proto__.x' is unsafe.
    const { mockFetch } = createMockFetch({
      jsonPayload: {
        'safe.key': 'valeur',
        'obj.__proto__.hack': 'malicious',
        'another.safe': 'autre',
      },
    });

    const result = await withMockFetch(mockFetch, () =>
      translateBatch(
        ['safe.key', 'obj.__proto__.hack', 'another.safe'],
        {
          'safe.key': 'value',
          'obj.__proto__.hack': 'proto',
          'another.safe': 'another',
        },
        { method: 'llm', name: 'French', register: 'Standard' },
        { apiKey: 'test-key' },
      ),
    );

    assert.ok(result);
    assert.equal(result['safe.key'], 'valeur');
    assert.equal(result['another.safe'], 'autre');
    // Prototype-pollution key (contains __proto__ segment) should be filtered
    assert.equal(result['obj.__proto__.hack'], undefined);
  });

  it('rejects keys not in the original request', async () => {
    const { mockFetch } = createMockFetch({
      jsonPayload: {
        'expected.key': 'valeur',
        'injected.key': 'malicious',
      },
    });

    const result = await withMockFetch(mockFetch, () =>
      translateBatch(
        ['expected.key'],
        { 'expected.key': 'value' },
        { method: 'llm', name: 'French', register: 'Standard' },
        { apiKey: 'test-key' },
      ),
    );

    assert.ok(result);
    assert.equal(result['expected.key'], 'valeur');
    assert.equal(result['injected.key'], undefined, 'Should not accept unrequested keys');
  });

  it('handles API error (non-retryable) gracefully', async () => {
    const { mockFetch } = createMockFetch({ status: 401 });

    const result = await withMockFetch(mockFetch, () =>
      translateBatch(
        ['test.key'],
        { 'test.key': 'Hello' },
        { method: 'llm', name: 'French', register: 'Standard' },
        { apiKey: 'bad-key' },
      ),
    );

    assert.equal(result, null);
  });

  it('handles malformed JSON response gracefully', async () => {
    const { mockFetch } = createMockFetch({ textPayload: 'not valid json {{{' });

    const result = await withMockFetch(mockFetch, () =>
      translateBatch(
        ['test.key'],
        { 'test.key': 'Hello' },
        { method: 'llm', name: 'French', register: 'Standard' },
        { apiKey: 'test-key' },
      ),
    );

    assert.equal(result, null);
  });

  it('sends correct temperature for LLM method', async () => {
    let capturedTemp;
    const { mockFetch } = createMockFetch({
      jsonPayload: { 'key': 'valeur' },
      requestValidator: ({ body }) => { capturedTemp = body.temperature; },
    });

    await withMockFetch(mockFetch, () =>
      translateBatch(
        ['key'],
        { 'key': 'value' },
        { method: 'llm', name: 'French', register: 'Standard' },
        { apiKey: 'test-key' },
      ),
    );

    assert.equal(typeof capturedTemp, 'number');
    assert.ok(capturedTemp >= 0 && capturedTemp <= 1, `Temperature ${capturedTemp} should be 0–1`);
  });
});

// =================================================================
// translateBatch — v2 compat path
// =================================================================

describe('integration: translateBatch v2 compat', () => {
  beforeEach(muteConsole);
  afterEach(restoreConsole);

  it('works with legacy langConfig (no method field)', async () => {
    const { mockFetch } = createMockFetch({
      jsonPayload: { 'greeting': 'Bonjour' },
    });

    const result = await withMockFetch(mockFetch, () =>
      translateBatch(
        ['greeting'],
        { 'greeting': 'Hello' },
        // v2 langConfig — no `method` field
        { name: 'French', register: 'Standard formal French.' },
        { apiKey: 'test-key' },
      ),
    );

    assert.ok(result);
    assert.equal(result['greeting'], 'Bonjour');
  });
});

// =================================================================
// translateRawContent — content translation pipeline
// =================================================================

describe('integration: translateRawContent', () => {
  beforeEach(muteConsole);
  afterEach(restoreConsole);

  it('returns translated text from the model', async () => {
    const { mockFetch, calls } = createMockFetch({
      textPayload: 'Bienvenue sur notre site web.',
    });

    const result = await withMockFetch(mockFetch, () =>
      translateRawContent(
        'Translate to French:\n\nWelcome to our website.',
        { apiKey: 'test-key' },
      ),
    );

    assert.ok(result);
    assert.ok(result.includes('Bienvenue'));
    assert.equal(calls.length, 1);
  });

  it('uses pairConfig method when provided', async () => {
    const { mockFetch, calls } = createMockFetch({
      textPayload: 'Contenu traduit.',
    });

    const result = await withMockFetch(mockFetch, () =>
      translateRawContent(
        'Translate this content.',
        {
          apiKey: 'test-key',
          pairConfig: {
            method: 'llm',
            model: 'google/gemini-2.0-flash',
          },
        },
      ),
    );

    assert.ok(result);
    assert.equal(calls[0].body.model, 'google/gemini-2.0-flash');
  });

  it('returns null on API failure', async () => {
    const { mockFetch } = createMockFetch({ status: 500 });

    const result = await withMockFetch(mockFetch, () =>
      translateRawContent('Test prompt.', { apiKey: 'test-key' }),
    );

    assert.equal(result, null);
  });

  it('strips code fences from model response', async () => {
    const { mockFetch } = createMockFetch({
      textPayload: '```\nContenu propre.\n```',
    });

    const result = await withMockFetch(mockFetch, () =>
      translateRawContent('Translate this.', { apiKey: 'test-key' }),
    );

    assert.ok(result);
    assert.ok(!result.includes('```'), 'Code fences should be stripped');
    assert.ok(result.includes('Contenu propre'));
  });
});

// =================================================================
// Method resolution — getMethod integration
// =================================================================

describe('integration: method resolution', () => {
  beforeEach(muteConsole);
  afterEach(restoreConsole);

  it('resolves all registered methods', () => {
    for (const methodName of Object.keys(METHOD_REGISTRY)) {
      const method = getMethod(methodName);
      assert.equal(method.name, methodName, `Should resolve ${methodName}`);
    }
  });

  it('throws descriptive error for unregistered methods', () => {
    assert.throws(
      () => getMethod('nonexistent-method-xyz'),
      /Unknown translation method "nonexistent-method-xyz"/,
    );
  });

  it('API method receives plugin context', () => {
    const method = getMethod('api', {
      endpoint: 'https://api.example.com/translate',
      pluginName: 'test-api-v1',
      pluginVersion: '2.0.0',
      qualityTier: 'research',
      pluginProvenance: { commercialReady: true, resources: [], flags: [] },
    });

    assert.equal(method.name, 'api');
    // The API method should have the endpoint configured
    assert.ok(method._endpoint || method.endpoint, 'API method should have endpoint');
  });
});

// =================================================================
// Plugin → Method pipeline — full E2E
// =================================================================

describe('integration: plugin-to-method pipeline', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempProject();
    muteConsole();
  });

  afterEach(() => {
    cleanupDir(tempDir);
    restoreConsole();
  });

  it('plugin config propagates through to translation call', async () => {
    // Set up a plugin with specific config
    const pluginDir = path.join(tempDir, '.champollion', 'methods', 'french-formal-v1');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'method.json'), JSON.stringify({
      name: 'french-formal-v1',
      type: 'llm',
      version: '1.0.0',
      locales: ['fr'],
      config: {
        model: 'anthropic/claude-3.5-sonnet',
        register: 'Formal French for enterprise',
        batchSize: 10,
      },
    }));

    // Load plugins and resolve for a pair
    const plugins = loadPlugins(tempDir);
    assert.equal(plugins.size, 1);

    const pairConfig = resolvePluginForPair(plugins, {
      source: 'en',
      target: 'fr',
      methodPlugin: 'french-formal-v1',
    });

    assert.equal(pairConfig.method, 'llm');
    assert.equal(pairConfig.model, 'anthropic/claude-3.5-sonnet');
    assert.equal(pairConfig.register, 'Formal French for enterprise');
    assert.equal(pairConfig.pluginName, 'french-formal-v1');

    // Now run through the actual translation pipeline
    let capturedModel;
    const { mockFetch } = createMockFetch({
      jsonPayload: { 'title': 'Titre' },
      requestValidator: ({ body }) => { capturedModel = body.model; },
    });

    const result = await withMockFetch(mockFetch, () =>
      translateBatch(
        ['title'],
        { 'title': 'Title' },
        pairConfig,
        { apiKey: 'test-key' },
      ),
    );

    assert.ok(result);
    assert.equal(result['title'], 'Titre');
    // Verify the plugin's model was propagated to the API call
    assert.equal(capturedModel, 'anthropic/claude-3.5-sonnet');
  });

  it('pair-level config overrides plugin defaults', async () => {
    const pluginDir = path.join(tempDir, '.champollion', 'methods', 'base-method-v1');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'method.json'), JSON.stringify({
      name: 'base-method-v1',
      type: 'llm',
      version: '1.0.0',
      locales: ['de'],
      config: {
        model: 'google/gemini-3.5-flash',
        register: 'Standard German',
      },
    }));

    const plugins = loadPlugins(tempDir);
    const pairConfig = resolvePluginForPair(plugins, {
      source: 'en',
      target: 'de',
      method: 'llm',
      model: 'google/gemini-2.0-flash', // Override the plugin's model
      methodPlugin: 'base-method-v1',
    });

    let capturedModel;
    const { mockFetch } = createMockFetch({
      jsonPayload: { 'label': 'Bezeichnung' },
      requestValidator: ({ body }) => { capturedModel = body.model; },
    });

    const result = await withMockFetch(mockFetch, () =>
      translateBatch(
        ['label'],
        { 'label': 'Label' },
        pairConfig,
        { apiKey: 'test-key' },
      ),
    );

    assert.ok(result);
    // Pair-level model should win over plugin default
    assert.equal(capturedModel, 'google/gemini-2.0-flash');
  });
});

// =================================================================
// OpenRouter client — retry behavior
// =================================================================

describe('integration: OpenRouter retry behavior', () => {
  beforeEach(muteConsole);
  afterEach(restoreConsole);

  it('returns null when all retries exhausted (non-retryable error)', async () => {
    // All calls return 401 (non-retryable) — should fail immediately
    const { mockFetch, calls } = createMockFetch({ status: 401 });

    const result = await withMockFetch(mockFetch, () =>
      translateBatch(
        ['key'],
        { 'key': 'value' },
        { method: 'llm', name: 'French', register: 'Standard' },
        { apiKey: 'test-key' },
      ),
    );

    assert.equal(result, null);
    // Non-retryable error: should only call once (no retries)
    assert.equal(calls.length, 1);
  });
});

// =================================================================
// Batch splitting — multi-batch translation
// =================================================================

describe('integration: batch splitting', () => {
  beforeEach(muteConsole);
  afterEach(restoreConsole);

  it('splits large key sets into multiple API calls', async () => {
    // Create 45 keys with a batch size of 20 → should make 3 calls
    const keys = [];
    const sourceFlat = {};
    const mockResponse = {};
    for (let i = 0; i < 45; i++) {
      const key = `key.item${i}`;
      keys.push(key);
      sourceFlat[key] = `Value ${i}`;
      mockResponse[key] = `Valeur ${i}`;
    }

    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      callCount++;
      const body = JSON.parse(options.body);
      // Keys are in the user message (last in the messages array).
      // With the system/user split, messages[0] is the preamble and
      // the JSON payload is in the final message.
      const userContent = body.messages[body.messages.length - 1].content;
      const batchKeys = keys.filter(k => userContent.includes(k));
      const batchResult = {};
      for (const k of batchKeys) {
        batchResult[k] = mockResponse[k];
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(batchResult) } }],
        }),
      };
    };

    try {
      const result = await translateBatch(
        keys,
        sourceFlat,
        { method: 'llm', name: 'French', register: 'Standard', batchSize: 20 },
        { apiKey: 'test-key', batchSize: 20 },
      );

      assert.ok(result);
      // All 45 keys should be present
      assert.equal(Object.keys(result).length, 45);
      assert.equal(result['key.item0'], 'Valeur 0');
      assert.equal(result['key.item44'], 'Valeur 44');
      // Should have made 3 calls (20 + 20 + 5)
      assert.equal(callCount, 3, 'Should split into 3 batches');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// =================================================================
// Code fence handling — model wraps response in markdown
// =================================================================

describe('integration: code fence handling', () => {
  beforeEach(muteConsole);
  afterEach(restoreConsole);

  it('handles JSON wrapped in ```json code fences', async () => {
    const { mockFetch } = createMockFetch({
      textPayload: '```json\n{"key": "valeur"}\n```',
    });

    const result = await withMockFetch(mockFetch, () =>
      translateBatch(
        ['key'],
        { 'key': 'value' },
        { method: 'llm', name: 'French', register: 'Standard' },
        { apiKey: 'test-key' },
      ),
    );

    assert.ok(result);
    assert.equal(result['key'], 'valeur');
  });

  it('handles JSON wrapped in bare ``` code fences', async () => {
    const { mockFetch } = createMockFetch({
      textPayload: '```\n{"key": "valeur"}\n```',
    });

    const result = await withMockFetch(mockFetch, () =>
      translateBatch(
        ['key'],
        { 'key': 'value' },
        { method: 'llm', name: 'French', register: 'Standard' },
        { apiKey: 'test-key' },
      ),
    );

    assert.ok(result);
    assert.equal(result['key'], 'valeur');
  });
});
