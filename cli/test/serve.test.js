/**
 * serve.test.js — E2E + safety tests for `champollion serve`.
 *
 * The serve command stands the owner's configured stack up behind the
 * api-method HTTP contract. These tests run the REAL chain end-to-end on
 * localhost:
 *
 *   consumer `champollion sync` (spawned CLI, api method / plugin manifest)
 *     → in-process serve server (lib/serve.js)
 *       → translate-pair pipeline (TM partition → quality gate → TM store)
 *         → owner's configured method (api → mock upstream HTTP server)
 *
 * Coverage per the founder spec:
 *   - round-trip translations + honest meta (quality_tier passthrough)
 *   - TM caching: repeat requests are cache hits, upstream untouched, $0
 *   - auth rejection (absent + wrong bearer token), refuse-to-start rules
 *   - per-IP rate limit (429 + Retry-After)
 *   - cost-cap refusal (unknown ≠ free; TM-covered requests stay free)
 *   - quality-gate failure surfaces as a structured error, never silent output
 *   - manifest emitter → `plugin install` → sync (one command each side)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

import {
  SERVE_DEFAULTS,
  createServeRuntime,
  deriveMethodName,
  minQualityTier,
  resolveManifestEndpoint,
  buildServeManifest,
  startServeServer,
  screenRequestKeys,
  isLoopbackBind,
} from '../lib/serve.js';
import { storeTM, tmMethodKey } from '../lib/tm.js';
import { validateManifest } from '../lib/plugins.js';

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

const SERVE_TOKEN = 'serve-secret-token-1234';
const UPSTREAM_KEY = 'upstream-key-for-tests';

// The owner stack's upstream credential — a dedicated env var name so a
// developer machine's real OPENROUTER/CHAMPOLLION keys can never leak into
// (or flake) these assertions.
process.env.SERVE_TEST_UPSTREAM_KEY = UPSTREAM_KEY;
delete process.env.CHAMPOLLION_API_KEY;

// -----------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Mock upstream translation service (the owner's configured `api` engine
 * points here). Speaks the same contract serve does — deterministic, no
 * real provider. A source value starting with "GATEBAIT" comes back as a
 * degeneration loop so the serve-side quality gate MUST reject it.
 */
function startMockUpstream() {
  const state = { requests: [] };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = JSON.parse(raw);
      state.requests.push({ auth: req.headers['authorization'], body });
      const translations = {};
      for (const [key, value] of Object.entries(body.keys)) {
        translations[key] = value.startsWith('GATEBAIT')
          ? 'zz zz zz zz zz zz zz zz zz zz zz zz' // repetition loop → gate reject
          : `fr::${value}`;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ translations, meta: { model: 'mock-upstream/v1', cost_usd: 0.001 } }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        server,
        state,
        url: `http://127.0.0.1:${server.address().port}/upstream`,
        close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
      });
    });
  });
}

/**
 * Write an owner project whose configured stack is: api method → mock
 * upstream, quality tier "high", upstream key from SERVE_TEST_UPSTREAM_KEY.
 */
function makeOwnerProject(upstreamUrl) {
  const dir = makeTempDir('champollion-serve-owner-');
  fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
    version: 3,
    inputLocale: 'en',
    localesDir: './locales',
    apiKeyEnvVar: 'SERVE_TEST_UPSTREAM_KEY',
    languages: [],
    pairs: {
      'en:fr': { method: 'api', endpoint: upstreamUrl, qualityTier: 'high' },
    },
  }, null, 2));
  return dir;
}

async function postTranslate(serveUrl, body, { token = SERVE_TOKEN, headers = {} } = {}) {
  const res = await fetch(serveUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON error paths return null */ }
  return { status: res.status, headers: res.headers, json };
}

/**
 * Spawn the CLI ASYNCHRONOUSLY. This must never be execFileSync: several
 * tests point a spawned consumer `sync` at a serve server running IN THIS
 * process — a synchronous spawn would block the event loop and deadlock
 * the child against a server that can no longer accept connections.
 */
function runCLI(args, cwd, env = {}) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI_PATH, ...args], {
      cwd,
      encoding: 'utf-8',
      timeout: 60_000,
      env: { ...process.env, ...env },
    }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        status: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
      });
    });
  });
}

// =================================================================
// 1. Engine safety invariants — refuse-to-start rules
// =================================================================
describe('serve: startup safety invariants', () => {
  it('refuses to start without a token when auth is on', async () => {
    await assert.rejects(
      startServeServer({ cwd: '/nonexistent-not-reached', token: null }),
      /bearer token/i,
    );
  });

  it('refuses --no-auth on a non-loopback bind', async () => {
    await assert.rejects(
      startServeServer({ cwd: '/nonexistent-not-reached', noAuth: true, bind: '0.0.0.0' }),
      /loopback/i,
    );
  });

  it('refuses tokens shorter than the minimum length', async () => {
    await assert.rejects(
      startServeServer({ cwd: '/nonexistent-not-reached', token: 'short' }),
      new RegExp(`${SERVE_DEFAULTS.minTokenLength} characters`),
    );
  });

  it('isLoopbackBind accepts loopback spellings only', () => {
    assert.equal(isLoopbackBind('127.0.0.1'), true);
    assert.equal(isLoopbackBind('::1'), true);
    assert.equal(isLoopbackBind('localhost'), true);
    assert.equal(isLoopbackBind('0.0.0.0'), false);
    assert.equal(isLoopbackBind('192.168.1.5'), false);
  });

  it('CLI `serve` exits 1 with guidance when no token is available', async () => {
    const dir = makeOwnerProject('http://127.0.0.1:9/unused');
    const env = { ...process.env };
    delete env.CHAMPOLLION_SERVE_TOKEN;
    const result = await runCLI(['serve', '--port', '0'], dir, env);
    fs.rmSync(dir, { recursive: true, force: true });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CHAMPOLLION_SERVE_TOKEN/);
  });
});

// =================================================================
// 2. Request screening (pure)
// =================================================================
describe('serve: request key screening', () => {
  it('drops unsafe key names and non-string values, keeps honest keys', () => {
    // Built via JSON.parse, exactly like a request body: JSON.parse creates
    // an OWN "__proto__" data property (an object literal would not).
    const { payload, keyNames, rejected } = screenRequestKeys(JSON.parse(
      '{"ok.key":"Hello there","num":42,"empty":"",' +
      '"__proto__":"boom","constructor.prototype.x":"boom"}'
    ));
    assert.deepEqual(keyNames, ['ok.key']);
    assert.equal(payload['ok.key'], 'Hello there');
    assert.match(rejected['__proto__'].message, /unsafe/);
    assert.match(rejected['constructor.prototype.x'].message, /unsafe/);
    assert.match(rejected['num'].message, /non-empty string/);
    assert.match(rejected['empty'].message, /non-empty string/);
    // The screened payload must be pollution-free
    assert.equal(Object.prototype.hasOwnProperty.call(payload, '__proto__'), false);
  });
});

// =================================================================
// 3. HTTP contract round-trip against the real pipeline
// =================================================================
describe('serve: contract round-trip (owner stack = api → mock upstream)', () => {
  let upstream;
  let ownerDir;
  let handle;

  before(async () => {
    upstream = await startMockUpstream();
    ownerDir = makeOwnerProject(upstream.url);
    handle = await startServeServer({
      cwd: ownerDir,
      port: 0,
      token: SERVE_TOKEN,
      methodName: 'test-served',
    });
  });

  after(async () => {
    await handle.close();
    await upstream.close();
    fs.rmSync(ownerDir, { recursive: true, force: true });
  });

  it('translates through the owner stack and returns honest meta', async () => {
    const { status, json } = await postTranslate(handle.url, {
      source_locale: 'en',
      target_locale: 'fr',
      method: 'default',
      keys: { greeting: 'Hello world', farewell: 'Good morning to you' },
    });
    assert.equal(status, 200);
    assert.deepEqual(json.translations, {
      greeting: 'fr::Hello world',
      farewell: 'fr::Good morning to you',
    });
    assert.equal(json.meta.quality_tier, 'high', 'quality tier must pass through from the pair config');
    assert.equal(json.meta.method, 'test-served');
    assert.equal(json.meta.method_type, 'api');
    assert.equal(json.meta.tm_hits, 0);
    assert.equal(json.meta.translated, 2);
    assert.match(json.meta.served_by, /^champollion-serve\//);
    // The owner's upstream saw the OWNER's credential, not the serve token
    assert.equal(upstream.state.requests.at(-1).auth, `Bearer ${UPSTREAM_KEY}`);
  });

  it('serves repeat requests from the TM: upstream untouched, cost $0', async () => {
    const upstreamCallsBefore = upstream.state.requests.length;
    const { status, json } = await postTranslate(handle.url, {
      source_locale: 'en',
      target_locale: 'fr',
      method: 'test-served',
      keys: { greeting: 'Hello world', farewell: 'Good morning to you' },
    });
    assert.equal(status, 200);
    assert.equal(json.meta.tm_hits, 2);
    assert.equal(json.meta.cost_usd, 0, 'fully TM-served request is a KNOWN $0');
    assert.equal(json.meta.cost_basis, 'tm-cache');
    assert.equal(json.translations.greeting, 'fr::Hello world');
    assert.equal(upstream.state.requests.length, upstreamCallsBefore, 'no upstream call for cached keys');
    // TM persisted to the owner project
    assert.ok(fs.existsSync(path.join(ownerDir, '.champollion', 'tm.json')), 'TM must persist to disk');
  });

  it('rejects requests without a token (401) before any upstream work', async () => {
    const upstreamCallsBefore = upstream.state.requests.length;
    const { status, json } = await postTranslate(handle.url, {
      source_locale: 'en', target_locale: 'fr', method: 'default',
      keys: { fresh: 'Never seen before string' },
    }, { token: null });
    assert.equal(status, 401);
    assert.equal(json.error.code, 'unauthorized');
    assert.equal(upstream.state.requests.length, upstreamCallsBefore);
  });

  it('rejects a wrong token (401)', async () => {
    const { status, json } = await postTranslate(handle.url, {
      source_locale: 'en', target_locale: 'fr', method: 'default',
      keys: { fresh: 'Never seen before string' },
    }, { token: 'wrong-token-wrong-token' });
    assert.equal(status, 401);
    assert.equal(json.error.code, 'unauthorized');
  });

  it('quality-gate failure is a structured per-key error, never silent output (207 partial)', async () => {
    const { status, json } = await postTranslate(handle.url, {
      source_locale: 'en', target_locale: 'fr', method: 'default',
      keys: { good: 'A perfectly nice sentence', bad: 'GATEBAIT trigger' },
    });
    assert.equal(status, 207, 'partial success must be 207, not a fake 200');
    assert.equal(json.translations.good, 'fr::A perfectly nice sentence');
    assert.equal(json.translations.bad, undefined, 'gate-rejected output must NOT be returned');
    assert.match(json.errors.bad.message, /quality gate/);
    assert.match(json.errors.bad.message, /repetition/);
    assert.equal(json.meta.failed, 1);
  });

  it('gate-rejected values are never cached: the bad key re-fails on retry', async () => {
    const { status, json } = await postTranslate(handle.url, {
      source_locale: 'en', target_locale: 'fr', method: 'default',
      keys: { good: 'A perfectly nice sentence', bad: 'GATEBAIT trigger' },
    });
    assert.equal(status, 207);
    assert.equal(json.meta.tm_hits, 1, 'only the validated key may be cached');
    assert.match(json.errors.bad.message, /quality gate/);
  });

  it('returns 422 when every key fails the gate', async () => {
    const { status, json } = await postTranslate(handle.url, {
      source_locale: 'en', target_locale: 'fr', method: 'default',
      keys: { doomed: 'GATEBAIT nothing survives' },
    });
    assert.equal(status, 422);
    assert.equal(json.error.code, 'quality_gate_failed');
    assert.match(json.errors.doomed.message, /quality gate/);
  });

  it('screens unsafe key names per-key (207) without sinking the batch', async () => {
    // Raw JSON body: an object literal would swallow "__proto__" before it
    // ever reached the wire (literal prototype-setter semantics).
    const { status, json } = await postTranslate(handle.url,
      '{"source_locale":"en","target_locale":"fr","method":"default",' +
      '"keys":{"__proto__":"polluted value","honest":"A fresh honest string"}}');
    assert.equal(status, 207);
    assert.equal(json.translations.honest, 'fr::A fresh honest string');
    assert.match(json.errors['__proto__'].message, /unsafe/);
  });

  it('404s an unknown method name, listing the served one', async () => {
    const { status, json } = await postTranslate(handle.url, {
      source_locale: 'en', target_locale: 'fr', method: 'some-other-method',
      keys: { k: 'Value here' },
    });
    assert.equal(status, 404);
    assert.equal(json.error.code, 'method_not_found');
    assert.match(json.error.message, /test-served/);
  });

  it('400s an unconfigured pair, listing the served pairs', async () => {
    const { status, json } = await postTranslate(handle.url, {
      source_locale: 'en', target_locale: 'de', method: 'default',
      keys: { k: 'Value here' },
    });
    assert.equal(status, 400);
    assert.equal(json.error.code, 'unsupported_pair');
    assert.match(json.error.message, /en:fr/);
  });

  it('400s malformed bodies and empty key sets', async () => {
    const badJson = await postTranslate(handle.url, '{not json');
    assert.equal(badJson.status, 400);
    assert.equal(badJson.json.error.code, 'invalid_json');

    const noKeys = await postTranslate(handle.url, {
      source_locale: 'en', target_locale: 'fr', method: 'default', keys: {},
    });
    assert.equal(noKeys.status, 400);

    const badKeys = await postTranslate(handle.url, {
      source_locale: 'en', target_locale: 'fr', method: 'default', keys: [1, 2],
    });
    assert.equal(badKeys.status, 400);
  });

  it('GET /health responds without auth; other routes 404/405', async () => {
    const base = handle.url.replace('/translate', '');
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const wrongPath = await fetch(`${base}/nope`, { method: 'POST' });
    assert.equal(wrongPath.status, 404);

    const wrongVerb = await fetch(handle.url, { method: 'GET' });
    assert.equal(wrongVerb.status, 405);
  });
});

// =================================================================
// 4. Rate limit + body size cap
// =================================================================
describe('serve: rate limit and body cap', () => {
  let upstream;
  let ownerDir;

  before(async () => {
    upstream = await startMockUpstream();
    ownerDir = makeOwnerProject(upstream.url);
  });

  after(async () => {
    await upstream.close();
    fs.rmSync(ownerDir, { recursive: true, force: true });
  });

  it('429s past the per-IP limit with a Retry-After header', async () => {
    const handle = await startServeServer({
      cwd: ownerDir, port: 0, noAuth: true, rateLimitPerMin: 3,
    });
    try {
      const body = { source_locale: 'en', target_locale: 'de', method: 'default', keys: { k: 'v' } };
      for (let i = 0; i < 3; i++) {
        const r = await postTranslate(handle.url, body, { token: null });
        assert.equal(r.status, 400, 'requests under the limit reach the handler');
      }
      const limited = await postTranslate(handle.url, body, { token: null });
      assert.equal(limited.status, 429);
      assert.equal(limited.json.error.code, 'rate_limited');
      assert.ok(Number(limited.headers.get('retry-after')) >= 1, 'Retry-After header present');
    } finally {
      await handle.close();
    }
  });

  it('413s oversized request bodies with a structured error', async () => {
    const handle = await startServeServer({
      cwd: ownerDir, port: 0, noAuth: true, maxBodyBytes: 1024,
    });
    try {
      const { status, json } = await postTranslate(handle.url, {
        source_locale: 'en', target_locale: 'fr', method: 'default',
        keys: { big: 'x'.repeat(4000) },
      }, { token: null });
      assert.equal(status, 413);
      assert.equal(json.error.code, 'payload_too_large');
    } finally {
      await handle.close();
    }
  });
});

// =================================================================
// 5. Cost guard — unknown ≠ free; TM hits stay free; session ceiling
// =================================================================
describe('serve: cost guard', () => {
  it('402s uncached keys when the method pricing is unknown under a cap', async () => {
    const upstream = await startMockUpstream();
    const ownerDir = makeOwnerProject(upstream.url);
    const handle = await startServeServer({
      cwd: ownerDir, port: 0, token: SERVE_TOKEN, maxCostPerRequest: 0.5,
    });
    try {
      const { status, json } = await postTranslate(handle.url, {
        source_locale: 'en', target_locale: 'fr', method: 'default',
        keys: { fresh: 'Uncached string under a cap' },
      });
      assert.equal(status, 402);
      assert.equal(json.error.code, 'cost_unknown', 'api-method pricing is unknown → refuse (unknown is not free)');
      assert.equal(upstream.state.requests.length, 0, 'refusal fires BEFORE any upstream call');
    } finally {
      await handle.close();
      await upstream.close();
      fs.rmSync(ownerDir, { recursive: true, force: true });
    }
  });

  it('serves fully TM-covered requests under a cap (known $0)', async () => {
    const upstream = await startMockUpstream();
    const ownerDir = makeOwnerProject(upstream.url);
    // Seed the runtime's TM directly, then hand the runtime to the server.
    const runtime = await createServeRuntime({ cwd: ownerDir });
    const pairConfig = runtime.resolvedPairs.get('en:fr');
    storeTM(runtime.tm, 'Cached ahead of time', 'fr', tmMethodKey(pairConfig), 'fr::Cached ahead of time');
    const handle = await startServeServer({
      cwd: ownerDir, runtime, port: 0, token: SERVE_TOKEN, maxCostPerRequest: 0.01,
    });
    try {
      const { status, json } = await postTranslate(handle.url, {
        source_locale: 'en', target_locale: 'fr', method: 'default',
        keys: { cached: 'Cached ahead of time' },
      });
      assert.equal(status, 200);
      assert.equal(json.translations.cached, 'fr::Cached ahead of time');
      assert.equal(json.meta.cost_usd, 0);
      assert.equal(json.meta.cost_basis, 'tm-cache');
      assert.equal(upstream.state.requests.length, 0);
    } finally {
      await handle.close();
      await upstream.close();
      fs.rmSync(ownerDir, { recursive: true, force: true });
    }
  });

  it('402s when a known estimate would break the session ceiling', async () => {
    // google-translate has deterministic table pricing (no network) — the
    // fake key only satisfies preflight; the cost gate refuses BEFORE any call.
    process.env.SERVE_TEST_GOOGLE_KEY_GUARD = '1';
    process.env.GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY || 'fake-key-for-preflight-only';
    const ownerDir = makeTempDir('champollion-serve-gcost-');
    fs.writeFileSync(path.join(ownerDir, 'champollion.config.json'), JSON.stringify({
      version: 3,
      inputLocale: 'en',
      localesDir: './locales',
      languages: [],
      pairs: { 'en:fr': { method: 'google-translate' } },
    }));
    const handle = await startServeServer({
      cwd: ownerDir, port: 0, token: SERVE_TOKEN, maxSessionCost: 0,
    });
    try {
      const { status, json } = await postTranslate(handle.url, {
        source_locale: 'en', target_locale: 'fr', method: 'default',
        keys: { k: 'Some string that would cost real money' },
      });
      assert.equal(status, 402);
      assert.equal(json.error.code, 'session_ceiling_exceeded');
      assert.equal(typeof json.estimated_cost_usd, 'number');
      assert.equal(json.session_ceiling_usd, 0);
    } finally {
      await handle.close();
      fs.rmSync(ownerDir, { recursive: true, force: true });
      if (process.env.GOOGLE_TRANSLATE_API_KEY === 'fake-key-for-preflight-only') {
        delete process.env.GOOGLE_TRANSLATE_API_KEY;
      }
      delete process.env.SERVE_TEST_GOOGLE_KEY_GUARD;
    }
  });
});

// =================================================================
// 6. Manifest emitter
// =================================================================
describe('serve: --emit-manifest', () => {
  it('emits a valid api-type plugin manifest with honest tier passthrough', async () => {
    const upstream = await startMockUpstream();
    const ownerDir = makeOwnerProject(upstream.url);
    const result = await runCLI(
      ['serve', '--emit-manifest', '--name', 'emitted-serve', '--endpoint', 'https://translate.example.org'],
      ownerDir,
    );
    await upstream.close();
    assert.equal(result.status, 0, `emit failed: ${result.stderr}`);

    const manifestPath = path.join(ownerDir, 'emitted-serve', 'method.json');
    assert.ok(fs.existsSync(manifestPath));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    fs.rmSync(ownerDir, { recursive: true, force: true });

    const validation = validateManifest(manifest);
    assert.equal(validation.valid, true, `manifest must install cleanly: ${validation.errors.join(', ')}`);
    assert.equal(manifest.type, 'api');
    assert.equal(manifest.name, 'emitted-serve');
    // Bare origin gets the standard path appended
    assert.equal(manifest.endpoint, 'https://translate.example.org/translate');
    assert.deepEqual(manifest.locales, ['fr']);
    assert.equal(manifest.config.qualityTier, 'high', 'tier is a passthrough of the served pair, never invented');
  });

  it('resolveManifestEndpoint appends /translate to bare origins, respects explicit paths', () => {
    assert.equal(resolveManifestEndpoint(null, 4000), 'http://127.0.0.1:4000/translate');
    assert.equal(resolveManifestEndpoint('https://x.example', 4000), 'https://x.example/translate');
    assert.equal(resolveManifestEndpoint('https://x.example/api/v2', 4000), 'https://x.example/api/v2');
    assert.throws(() => resolveManifestEndpoint('ftp://x.example', 4000), /http or https/);
    assert.throws(() => resolveManifestEndpoint('not a url', 4000), /absolute/);
  });

  it('deriveMethodName produces installable kebab-case names', () => {
    assert.equal(deriveMethodName('/tmp/My Project!!'), 'my-project-serve');
    assert.match(deriveMethodName('/tmp/---'), /^champollion-serve$/);
    for (const name of [deriveMethodName('/tmp/Ünïcode Prøject'), deriveMethodName('/x/y/z')]) {
      assert.match(name, /^[a-z0-9][a-z0-9-]*$/);
    }
  });

  it('minQualityTier picks the most conservative tier across pairs', () => {
    assert.equal(minQualityTier([['a', { qualityTier: 'research' }], ['b', { qualityTier: 'standard' }]]), 'standard');
    assert.equal(minQualityTier([['a', { qualityTier: 'high' }], ['b', { qualityTier: 'verified' }]]), 'high');
    assert.equal(minQualityTier([['a', {}]]), 'standard');
  });
});

// =================================================================
// 7. Full E2E: consumer `champollion sync` → serve → owner stack
// =================================================================
describe('serve: consumer sync E2E (the api.js client against a live serve)', () => {
  let upstream;
  let ownerDir;
  let handle;

  before(async () => {
    upstream = await startMockUpstream();
    ownerDir = makeOwnerProject(upstream.url);
    handle = await startServeServer({
      cwd: ownerDir, port: 0, token: SERVE_TOKEN, methodName: 'test-served',
    });
  });

  after(async () => {
    await handle.close();
    await upstream.close();
    fs.rmSync(ownerDir, { recursive: true, force: true });
  });

  function makeConsumerProject(pairsBlock) {
    const dir = makeTempDir('champollion-serve-consumer-');
    fs.mkdirSync(path.join(dir, 'locales'));
    fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify({
      greeting: 'Hello world friend',
      farewell: 'See you tomorrow',
    }, null, 2));
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      version: 3,
      inputLocale: 'en',
      localesDir: './locales',
      apiKeyEnvVar: 'CHAMPOLLION_API_KEY',
      languages: [],
      pairs: pairsBlock,
    }, null, 2));
    return dir;
  }

  const consumerEnv = () => {
    const env = { ...process.env, CHAMPOLLION_API_KEY: SERVE_TOKEN };
    delete env.OPENROUTER_API_KEY; // hermetic: the consumer must auth with the serve token
    return env;
  };

  it('a real sync round-trips: translations written, exit 0', async () => {
    const consumerDir = makeConsumerProject({
      'en:fr': { method: 'api', endpoint: handle.url },
    });
    const result = await runCLI(['sync'], consumerDir, consumerEnv());
    const frPath = path.join(consumerDir, 'locales', 'fr.json');
    const fr = fs.existsSync(frPath) ? JSON.parse(fs.readFileSync(frPath, 'utf-8')) : null;
    fs.rmSync(consumerDir, { recursive: true, force: true });

    assert.equal(result.status, 0, `sync failed:\n${result.stdout}\n${result.stderr}`);
    assert.deepEqual(fr, {
      greeting: 'fr::Hello world friend',
      farewell: 'fr::See you tomorrow',
    });
  });

  it('a wrong consumer token fails the sync loudly (no silent English output)', async () => {
    const consumerDir = makeConsumerProject({
      'en:fr': { method: 'api', endpoint: handle.url },
    });
    const env = consumerEnv();
    env.CHAMPOLLION_API_KEY = 'not-the-right-token-at-all';
    const result = await runCLI(['sync'], consumerDir, env);
    const frPath = path.join(consumerDir, 'locales', 'fr.json');
    const frExists = fs.existsSync(frPath);
    const fr = frExists ? JSON.parse(fs.readFileSync(frPath, 'utf-8')) : {};
    fs.rmSync(consumerDir, { recursive: true, force: true });

    assert.notEqual(result.status, 0, 'a fully-failed sync must not exit 0');
    assert.match(result.stdout + result.stderr, /Unauthorized|Invalid bearer|invalid/i);
    assert.equal(Object.keys(fr).includes('greeting') && fr.greeting.startsWith('fr::'), false,
      'no translations may appear without valid auth');
  });

  it('one command each side: --emit-manifest → plugin install → sync', async () => {
    // Owner side: emit the manifest pointing at the live server
    const emit = await runCLI(
      ['serve', '--emit-manifest', '--name', 'test-served', '--endpoint', handle.url],
      ownerDir,
    );
    assert.equal(emit.status, 0, `emit failed: ${emit.stderr}`);
    const manifestDir = path.join(ownerDir, 'test-served');

    // Consumer side: install the plugin, reference it, sync
    const consumerDir = makeConsumerProject({
      'en:fr': { methodPlugin: 'test-served' },
    });
    const install = await runCLI(['plugin', 'install', manifestDir], consumerDir, consumerEnv());
    assert.equal(install.status, 0, `plugin install failed:\n${install.stdout}\n${install.stderr}`);

    const result = await runCLI(['sync'], consumerDir, consumerEnv());
    const frPath = path.join(consumerDir, 'locales', 'fr.json');
    const fr = fs.existsSync(frPath) ? JSON.parse(fs.readFileSync(frPath, 'utf-8')) : null;
    fs.rmSync(consumerDir, { recursive: true, force: true });

    assert.equal(result.status, 0, `sync via plugin failed:\n${result.stdout}\n${result.stderr}`);
    assert.equal(fr.greeting, 'fr::Hello world friend');
    assert.equal(fr.farewell, 'fr::See you tomorrow');
  });
});
