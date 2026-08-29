import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { getMethod } from '../lib/translate.js';
import { LocalMethod } from '../lib/methods/local.js';
import { OpenAIMethod } from '../lib/methods/openai.js';

// LocalMethod + base_url (OpenAI-compatible endpoints) — mirrors the harness
// LocalProvider/OpenAIProvider behavior. No network calls.

describe('LocalMethod + base_url (OpenAI-compatible)', () => {
  const ENV_KEYS = ['OPENAI_API_BASE', 'LOCAL_API_BASE'];
  const saved = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('is registered and resolves via getMethod', () => {
    const m = getMethod('local');
    assert.equal(m.name, 'local');
    assert.ok(m instanceof LocalMethod);
  });

  it('defaults to the Ollama endpoint', () => {
    assert.equal(new LocalMethod()._resolveApiBase(), 'http://localhost:11434/v1');
  });

  it('OpenAIMethod defaults to the OpenAI endpoint', () => {
    assert.equal(new OpenAIMethod()._resolveApiBase(), 'https://api.openai.com/v1');
  });

  it('OPENAI_API_BASE overrides the OpenAI endpoint', () => {
    process.env.OPENAI_API_BASE = 'https://api.groq.com/openai/v1';
    assert.equal(new OpenAIMethod()._resolveApiBase(), 'https://api.groq.com/openai/v1');
  });

  it('LOCAL_API_BASE overrides local and beats OPENAI_API_BASE', () => {
    process.env.OPENAI_API_BASE = 'https://should-not-win/v1';
    process.env.LOCAL_API_BASE = 'http://localhost:8000/v1';
    assert.equal(new LocalMethod()._resolveApiBase(), 'http://localhost:8000/v1');
  });

  it('normalizes a full /chat/completions URL to the base', () => {
    process.env.OPENAI_API_BASE = 'http://host/v1/chat/completions/';
    assert.equal(new OpenAIMethod()._resolveApiBase(), 'http://host/v1');
  });

  it('builds the request URL from the resolved base', () => {
    process.env.OPENAI_API_BASE = 'http://host:1234/v1';
    const req = new OpenAIMethod()._buildApiRequest({
      prompt: 'x', systemMessage: null, apiKey: 'k',
      model: 'gpt-4o', temperature: 0, isJsonMode: false,
    });
    assert.equal(req.url, 'http://host:1234/v1/chat/completions');
  });

  it('fail-honest cost: local estimateCost is null, never $0', () => {
    assert.equal(new LocalMethod().estimateCost(100).estimatedCost, null);
  });

  it('local is ready without an API key', () => {
    assert.equal(new LocalMethod().checkReadiness({}).ready, true);
  });
});
