/**
 * Provider routing — what the CLI actually sends, and to whom.
 *
 * Two defects from the 2026-09-27 methods audit, both "the config says one
 * thing, the wire carries another":
 *
 *   1. `provider` (openai / anthropic / gemini / local) was unreachable from
 *      config. llm-coached dispatches on pairConfig.provider, but pairs.js never
 *      copied the field into the pair graph, and config.js treated a top-level
 *      `provider` as a misspelling of `defaultMethod`. A harness `export-config`
 *      snippet carrying `provider` therefore ran through OpenRouter.
 *   2. The `local` method's default model (llama3.1) was dead: `local` was
 *      missing from DIRECT_PROVIDER_METHODS, so the global OpenRouter slug was
 *      sent to Ollama.
 *
 * These tests stub global fetch and assert on the outgoing request — the URL
 * and the model — rather than on intermediate config shapes alone.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveConfig, DEFAULT_OPENROUTER_MODEL } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';
import { translateBatch, getMethod } from '../lib/translate.js';

process.env.CHAMPOLLION_PRICING_OFFLINE = '1';

const ENV_KEYS = [
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY',
  'OPENAI_API_BASE', 'LOCAL_API_BASE',
];

/**
 * Stub fetch with an OpenAI-format server. Records every request; answers
 * /models with a model list and /chat/completions with a JSON translation of
 * every key in the user message.
 */
function installFetchStub(calls) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), body });
    if (String(url).endsWith('/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }, { id: 'llama3.1' }] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    const user = body.messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
    const payload = JSON.parse(user.slice(user.indexOf('{')));
    const out = Object.fromEntries(Object.keys(payload).map(k => [k, `FR:${payload[k]}`]));
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(out) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return () => { globalThis.fetch = realFetch; };
}

function writeConfig(dir, config) {
  fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify(config));
}

function captureWarnings(fn) {
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    return { result: fn(), warnings };
  } finally {
    console.warn = realWarn;
  }
}

describe('provider routing (audit item 1: provider unreachable from config)', () => {
  let tempDir;
  const saved = {};
  let calls;
  let restoreFetch;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-provider-'));
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    calls = [];
    restoreFetch = installFetchStub(calls);
  });

  afterEach(() => {
    restoreFetch();
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('a top-level provider is a real field, not a misspelling of defaultMethod', () => {
    writeConfig(tempDir, { defaultMethod: 'llm-coached', provider: 'openai', languages: ['fr'] });
    const { result: config, warnings } = captureWarnings(() => resolveConfig({}, tempDir));
    assert.deepEqual(warnings.filter(w => /provider/.test(w)), [],
      'provider must not be flagged as an unknown field');
    assert.equal(config.provider, 'openai');
    assert.equal(config.defaultMethod, 'llm-coached', 'provider must not overwrite defaultMethod');
  });

  it('carries the provider into every llm-coached pair', () => {
    writeConfig(tempDir, { defaultMethod: 'llm-coached', provider: 'openai', languages: ['fr', 'de'] });
    const pairs = resolvePairs(resolveConfig({}, tempDir));
    for (const key of ['en:fr', 'en:de']) {
      assert.equal(pairs.get(key).method, 'llm-coached');
      assert.equal(pairs.get(key).provider, 'openai', `${key} lost its provider`);
    }
  });

  it('per-language and per-pair provider override the top-level one', () => {
    writeConfig(tempDir, {
      defaultMethod: 'llm-coached',
      provider: 'openai',
      languages: { fr: { provider: 'anthropic' }, de: {} },
      pairs: { 'en:es': { provider: 'gemini' } },
    });
    const pairs = resolvePairs(resolveConfig({}, tempDir));
    assert.equal(pairs.get('en:fr').provider, 'anthropic');
    assert.equal(pairs.get('en:de').provider, 'openai');
    assert.equal(pairs.get('en:es').provider, 'gemini');
  });

  it('a coached pair with provider openai calls api.openai.com, not OpenRouter', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    fs.writeFileSync(path.join(tempDir, 'coach.txt'), 'Use formal register.');
    writeConfig(tempDir, {
      defaultMethod: 'llm-coached', provider: 'openai', model: 'gpt-4o-mini',
      coachingFile: 'coach.txt', languages: ['fr'],
    });
    const config = resolveConfig({}, tempDir);
    const pair = resolvePairs(config).get('en:fr');

    const out = await translateBatch(['greeting'], { greeting: 'Hello' }, pair, {
      apiKey: 'or-key-must-not-be-used', cwd: tempDir,
    });

    assert.deepEqual(out, { greeting: 'FR:Hello' });
    const completions = calls.filter(c => c.url.endsWith('/chat/completions'));
    assert.equal(completions.length, 1);
    assert.equal(completions[0].url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(completions[0].body.model, 'gpt-4o-mini',
      'the model the config (and the harness export) named must be the model sent');
    assert.ok(calls.every(c => !c.url.includes('openrouter.ai')), 'nothing may go to OpenRouter');
    const system = completions[0].body.messages.find(m => m.role === 'system').content;
    assert.match(system, /Use formal register\./, 'coaching must ride along on the direct provider');
  });

  it('a coached pair with a provider but no model uses that provider\'s default, never the OpenRouter slug', async () => {
    writeConfig(tempDir, { defaultMethod: 'llm-coached', provider: 'openai', languages: ['fr'] });
    const pair = resolvePairs(resolveConfig({}, tempDir)).get('en:fr');
    assert.notEqual(pair.model, DEFAULT_OPENROUTER_MODEL);
    assert.equal(pair.model, null, 'null lets the provider pick its own default model');
  });

  it('a harness export-config snippet (defaultMethod llm + provider) runs on that provider', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    // Shape emitted by arena/mt_eval_harness/config_exporter.py for a naive
    // run validated with --provider openai.
    writeConfig(tempDir, {
      _generated_by: 'mt-eval export-config v1',
      model: 'gpt-4o-mini',
      temperature: 0,
      batchSize: 40,
      defaultMethod: 'llm',
      languages: { fr: { register: 'neutral' } },
      provider: 'openai',
    });
    const pair = resolvePairs(resolveConfig({}, tempDir)).get('en:fr');
    assert.equal(pair.method, 'openai', 'plain llm on a direct provider is that provider\'s method');
    assert.equal(pair.model, 'gpt-4o-mini');

    await translateBatch(['greeting'], { greeting: 'Hello' }, pair, { apiKey: null, cwd: tempDir });
    const completion = calls.find(c => c.url.endsWith('/chat/completions'));
    assert.equal(completion.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(completion.body.model, 'gpt-4o-mini');
  });

  it('an explicit OpenRouter provider changes nothing', () => {
    writeConfig(tempDir, { defaultMethod: 'llm', provider: 'openrouter', languages: ['fr'] });
    const pair = resolvePairs(resolveConfig({}, tempDir)).get('en:fr');
    assert.equal(pair.method, 'llm');
    assert.equal(pair.provider, 'openrouter');
    assert.equal(pair.model, DEFAULT_OPENROUTER_MODEL);
  });

  it('refuses an unknown provider instead of silently falling back to OpenRouter', () => {
    writeConfig(tempDir, { defaultMethod: 'llm-coached', provider: 'opanai', languages: ['fr'] });
    assert.throws(() => resolvePairs(resolveConfig({}, tempDir)), /provider "opanai"/);
  });

  it('refuses a provider set on a method that chooses its own transport', () => {
    writeConfig(tempDir, { languages: { fr: { method: 'deepl', provider: 'openai' } } });
    assert.throws(() => resolvePairs(resolveConfig({}, tempDir)), /provider/);
  });

  it('a top-level provider leaves non-LLM pairs on their own engine', () => {
    writeConfig(tempDir, {
      defaultMethod: 'llm-coached', provider: 'openai',
      languages: { fr: { method: 'deepl' }, de: {} },
    });
    const pairs = resolvePairs(resolveConfig({}, tempDir));
    assert.equal(pairs.get('en:fr').method, 'deepl');
    assert.equal(pairs.get('en:de').provider, 'openai');
  });

  it('preflight for a coached openai pair checks the OpenAI key, not the OpenRouter key', async () => {
    writeConfig(tempDir, { defaultMethod: 'llm-coached', provider: 'openai', languages: ['fr'] });
    const pair = resolvePairs(resolveConfig({}, tempDir)).get('en:fr');
    const method = getMethod(pair.method, pair);

    const missing = await method.checkReadiness({ apiKey: null, cwd: tempDir });
    assert.equal(missing.ready, false);
    assert.match(missing.reason, /OPENAI_API_KEY/);

    process.env.OPENAI_API_KEY = 'sk-test';
    const ready = await method.checkReadiness({ apiKey: null, cwd: tempDir });
    assert.equal(ready.ready, true, 'no OpenRouter key is needed to run on OpenAI');
  });
});

describe('local method model (audit item 2: llama3.1 default was dead)', () => {
  let tempDir;
  const saved = {};
  let calls;
  let restoreFetch;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-local-'));
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    calls = [];
    restoreFetch = installFetchStub(calls);
  });

  afterEach(() => {
    restoreFetch();
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('a local pair without a model does not inherit the OpenRouter slug', () => {
    writeConfig(tempDir, { languages: { fr: { method: 'local' } } });
    const pair = resolvePairs(resolveConfig({}, tempDir)).get('en:fr');
    assert.equal(pair.model, null);
  });

  it('sends llama3.1 to the Ollama endpoint when no model is configured', async () => {
    writeConfig(tempDir, { defaultMethod: 'local', languages: ['fr'] });
    const pair = resolvePairs(resolveConfig({}, tempDir)).get('en:fr');
    await translateBatch(['greeting'], { greeting: 'Hello' }, pair, { apiKey: null, cwd: tempDir });
    const completion = calls.find(c => c.url.endsWith('/chat/completions'));
    assert.equal(completion.url, 'http://localhost:11434/v1/chat/completions');
    assert.equal(completion.body.model, 'llama3.1');
  });

  it('an explicit per-language model still wins', () => {
    writeConfig(tempDir, { languages: { fr: { method: 'local', model: 'qwen2.5' } } });
    assert.equal(resolvePairs(resolveConfig({}, tempDir)).get('en:fr').model, 'qwen2.5');
  });
});
