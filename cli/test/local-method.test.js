import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

import { getMethod } from '../lib/translate.js';
import { LocalMethod } from '../lib/methods/local.js';
import { OpenAIMethod } from '../lib/methods/openai.js';
import { AnthropicMethod } from '../lib/methods/anthropic.js';

// LocalMethod + base_url (OpenAI-compatible endpoints) — mirrors the harness
// LocalProvider/OpenAIProvider behavior. No network calls.

describe('LocalMethod + base_url (OpenAI-compatible)', () => {
  const ENV_KEYS = ['OPENAI_API_BASE', 'LOCAL_API_BASE', 'OPENAI_BASE_URL'];
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

  it('OPENAI_BASE_URL (the OpenAI SDK name) is honoured by openai and local', () => {
    process.env.OPENAI_BASE_URL = 'http://127.0.0.1:8000/v1';
    assert.equal(new OpenAIMethod()._resolveApiBase(), 'http://127.0.0.1:8000/v1');
    assert.equal(new LocalMethod()._resolveApiBase(), 'http://127.0.0.1:8000/v1');
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

  it('fail-honest cost: a local endpoint on ANOTHER machine is unknown (null), never $0', () => {
    process.env.LOCAL_API_BASE = 'http://192.168.1.20:11434/v1';
    assert.equal(new LocalMethod().estimateCost(100).estimatedCost, null);
    process.env.LOCAL_API_BASE = 'https://api.groq.com/openai/v1';
    assert.equal(new LocalMethod().estimateCost(100).estimatedCost, null);
  });

  it('a model served on THIS machine is $0 API cost, said as such (Round 3)', () => {
    // Ollama's default endpoint is localhost.
    const est = new LocalMethod().estimateCost(100);
    assert.equal(est.estimatedCost, 0);
    assert.equal(est.local, true);
    assert.match(est.note, /this machine/);
    for (const base of ['http://127.0.0.1:8080/v1', 'http://[::1]:9/v1']) {
      process.env.LOCAL_API_BASE = base;
      assert.equal(new LocalMethod().estimateCost(1).estimatedCost, 0, base);
    }
  });

  it('local is ready without an API key — when its server answers', async () => {
    const http = await import('node:http');
    const server = http.createServer((req, res) => { res.writeHead(404); res.end(); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    try {
      const m = new LocalMethod({ baseUrl: `http://127.0.0.1:${server.address().port}/v1` });
      assert.equal((await m.checkReadiness({})).ready, true, 'any HTTP answer counts (a 404 too)');
    } finally {
      await new Promise(r => server.close(r));
    }
  });

  it('local is not ready when nothing answers at its endpoint — and says where, and what to do', async () => {
    const m = new LocalMethod({ baseUrl: 'http://127.0.0.1:9/v1' });
    const r = await m.checkReadiness({});
    assert.equal(r.ready, false);
    assert.match(r.reason, /the config uses the "local" method, and no model server answers at http:\/\/127\.0\.0\.1:9\/v1/);
  });
});

describe('local method stays on the machine', () => {
  it('never lists models from api.openai.com', async () => {
    const realFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, ...rest) => { calls.push(String(url)); return realFetch(url, ...rest); };
    try {
      const m = new LocalMethod();
      assert.equal(await m._fetchModels('not-needed'), null);
      assert.equal(calls.filter((u) => u.includes('api.openai.com')).length, 0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

// ── The endpoint a failed run tried, and the setting that chose it ──
// Synthetic i18next persona, 2026-10: a local run against a dead port said
// "fetch failed" and nothing else — not the URL, not which of four settings
// (LOCAL_API_BASE / OPENAI_API_BASE / OPENAI_BASE_URL / the Ollama default)
// had picked it.
describe('local: a connection failure names the URL and where it came from', () => {
  const ENV_KEYS = ['OPENAI_API_BASE', 'LOCAL_API_BASE', 'OPENAI_BASE_URL'];
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

  it('each setting is named in precedence order, and the default is called the default', () => {
    assert.equal(new LocalMethod()._describeEndpoint(), 'http://localhost:11434/v1 (from the default, Ollama)');
    process.env.OPENAI_BASE_URL = 'http://127.0.0.1:8001/v1';
    assert.equal(new LocalMethod()._describeEndpoint(), 'http://127.0.0.1:8001/v1 (from OPENAI_BASE_URL)');
    process.env.OPENAI_API_BASE = 'http://127.0.0.1:8002/v1/';
    assert.equal(new LocalMethod()._describeEndpoint(), 'http://127.0.0.1:8002/v1 (from OPENAI_API_BASE)');
    process.env.LOCAL_API_BASE = 'http://127.0.0.1:8003/v1/chat/completions';
    assert.equal(new LocalMethod()._describeEndpoint(), 'http://127.0.0.1:8003/v1 (from LOCAL_API_BASE)');
  });

  it('a value from a project .env file says which file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-env-'));
    fs.writeFileSync(path.join(dir, '.env'), 'LOCAL_API_BASE=http://127.0.0.1:8004/v1\n');
    assert.equal(new LocalMethod()._describeEndpoint({ cwd: dir }),
      `http://127.0.0.1:8004/v1 (from LOCAL_API_BASE in ${path.relative(process.cwd(), path.join(dir, '.env'))})`);
  });

  it('the run\'s error line and the setup help both name it', async () => {
    // A port nothing listens on: bind one, then close it.
    const probe = net.createServer();
    await new Promise((r) => probe.listen(0, '127.0.0.1', r));
    const port = probe.address().port;
    await new Promise((r) => probe.close(r));
    const url = `http://127.0.0.1:${port}/v1`;
    process.env.LOCAL_API_BASE = url;
    const lines = [];
    const orig = { log: console.log, error: console.error };
    console.log = (...a) => lines.push(a.join(' '));
    console.error = (...a) => lines.push(a.join(' '));
    const realSetTimeout = globalThis.setTimeout;
    // Skip the retry back-off sleeps; the requests themselves are real.
    globalThis.setTimeout = (fn, ms, ...rest) => realSetTimeout(fn, ms > 500 && ms < 20000 ? 0 : ms, ...rest);
    try {
      const m = new LocalMethod();
      const out = await m.translate(['a'], { a: 'Hello' }, { target: 'fr', name: 'French', maxRetries: 0 }, {});
      assert.equal(out, null);
    } finally {
      console.log = orig.log;
      console.error = orig.error;
      globalThis.setTimeout = realSetTimeout;
    }
    const failure = lines.find((l) => /failed:/.test(l));
    assert.ok(failure, lines.join('\n'));
    assert.ok(failure.includes(`could not reach ${url} (from LOCAL_API_BASE)`), failure);
    assert.match(failure, /ECONNREFUSED/);
    assert.ok(new LocalMethod().getSetupHelp().some((l) => l.includes(`${url} (from LOCAL_API_BASE)`)));
  });

  it('a hosted provider with no configurable base names nothing it does not call', () => {
    process.env.OPENAI_API_BASE = 'http://should-not-be-named/v1';
    assert.equal(new AnthropicMethod()._describeEndpoint(), null);
  });
});
