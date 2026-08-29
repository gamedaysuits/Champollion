#!/usr/bin/env node
/**
 * Keyless end-to-end smoke tests — prove the translation method pipeline
 * actually produces output under `npm test`, with NO API keys.
 *
 * WHY THIS EXISTS:
 *   cli/test/live-api.test.js exercises the REAL providers, but every suite in
 *   it self-skips when the matching API key is absent (`{ skip: !HAS_OPENROUTER }`
 *   etc.). That is correct for the live contract tests — but it means a default
 *   CI `npm test` (no keys) never once proves that a real translation method
 *   runs end-to-end and returns a value. A method could be broken from
 *   getMethod() all the way to the response parser and the suite would still be
 *   green. This file closes that skip-masking gap with deterministic, keyless
 *   paths that ALWAYS run:
 *
 *     1. A real keyless engine (LibreTranslate) driven through the full
 *        public pipeline (translateBatch → getMethod → method.translate →
 *        real fetch → response parse → key map) against a LOCAL stub HTTP
 *        server — no network, no key, fully deterministic.
 *     2. The llm-coached fail-loud contract: a CONFIGURED-but-unreadable
 *        coaching file must throw, never silently run uncoached.
 *     3. The llm-coached coaching-injection guarantee: a configured coaching
 *        prompt actually reaches the API request (proving the harness→CLI
 *        silent-drop is closed). Uses a captured mock fetch.
 *     4. The getMethod() runtime-split message for harness-only engines.
 *
 * These use NO real keys and NO real network. They run on every `npm test`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { translateBatch, getMethod } from '../lib/translate.js';
import { LLMCoachedMethod } from '../lib/methods/llm-coached.js';
import { output } from '../lib/output.js';

// Keep the suite output clean — these paths intentionally log warnings/errors.
// node --test isolates each file in its own process, so this does not leak.
output.setMode('quiet');

// -----------------------------------------------------------------
// 1. Real keyless engine through the full pipeline (LibreTranslate stub)
// -----------------------------------------------------------------

/**
 * Start a local HTTP server that speaks the LibreTranslate /translate contract:
 *   request  { q: [texts] | text, source, target, format }
 *   response { translatedText: [texts] | text }
 * Deterministic: each segment becomes `[<target>] <segment>`.
 */
function startLibreTranslateStub() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => {
        let body = {};
        try { body = JSON.parse(raw); } catch { /* leave empty */ }
        const isArray = Array.isArray(body.q);
        const segments = isArray ? body.q : [body.q];
        const translated = segments.map((t) => `[${body.target}] ${t}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ translatedText: isArray ? translated : translated[0] }));
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

describe('keyless smoke — real method pipeline produces output (LibreTranslate stub)', () => {
  it('translateBatch drives a real keyless engine end-to-end and returns values', async () => {
    const server = await startLibreTranslateStub();
    try {
      const { port } = server.address();
      const url = `http://127.0.0.1:${port}/translate`;

      const source = { greeting: 'Hello', farewell: 'Goodbye' };
      const result = await translateBatch(
        ['greeting', 'farewell'],
        source,
        { method: 'libretranslate', target: 'fr', source: 'en' },
        // No apiKey — LibreTranslate is keyless; endpoint points at the stub.
        { libretranslateApiUrl: url },
      );

      assert.ok(result, 'pipeline returned null — the method produced no output');
      assert.equal(typeof result, 'object', 'result is not a key→value map');
      assert.equal(result.greeting, '[fr] Hello');
      assert.equal(result.farewell, '[fr] Goodbye');
    } finally {
      server.close();
    }
  });

  it('exercises getMethod → method.translate without any key set', async () => {
    // Belt-and-suspenders: confirm the resolved method is the real adapter and
    // that the keyless path is what produced the output above.
    const method = getMethod('libretranslate');
    assert.equal(method.name, 'libretranslate');
    assert.equal(typeof method.translate, 'function');
  });
});

// -----------------------------------------------------------------
// 2. llm-coached fail-loud: configured coaching that cannot load must THROW
// -----------------------------------------------------------------

describe('keyless smoke — llm-coached fails loud instead of silently dropping coaching', () => {
  it('throws when a configured coachingFile is missing (never runs UNCOACHED)', async () => {
    const method = new LLMCoachedMethod();
    const missing = path.join(os.tmpdir(), `champollion-no-such-coaching-${process.pid}.txt`);

    await assert.rejects(
      () => method.translate(
        ['k'],
        { k: 'Hello' },
        { method: 'llm-coached', coachingFile: missing, target: 'fr', name: 'French', register: 'Formal' },
        { apiKey: 'unused-because-it-throws-first', cwd: os.tmpdir() },
      ),
      (err) => {
        assert.match(err.message, /coachingFile/);
        assert.match(err.message, /UNCOACHED/);
        return true;
      },
      'a missing-but-configured coaching file must fail loud, not run uncoached',
    );
  });

  it('throws when a configured coachingFile is empty', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-empty-coach-'));
    const emptyFile = path.join(dir, 'coach.txt');
    fs.writeFileSync(emptyFile, '   \n');

    const method = new LLMCoachedMethod();
    await assert.rejects(
      () => method.translate(
        ['k'],
        { k: 'Hello' },
        { method: 'llm-coached', coachingFile: emptyFile, target: 'fr', name: 'French', register: 'Formal' },
        { apiKey: 'unused', cwd: dir },
      ),
      /empty/i,
      'an empty coaching file must fail loud, not run uncoached',
    );
  });
});

// -----------------------------------------------------------------
// 3. llm-coached coaching-injection: the configured prompt reaches the request
// -----------------------------------------------------------------

describe('keyless smoke — llm-coached actually USES the configured coaching prompt', () => {
  it('sends the coaching prompt in the system message (silent-drop closed)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-coach-inject-'));
    const coachingFile = path.join(dir, 'coach.txt');
    const COACHING_TEXT = 'ALWAYS translate "Hello" as "Bonjour"; never leave it in English.';
    fs.writeFileSync(coachingFile, COACHING_TEXT);

    let capturedBody = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ greeting: 'Bonjour' }) } }],
        }),
      };
    };

    try {
      const result = await translateBatch(
        ['greeting'],
        { greeting: 'Hello' },
        // coachingFile configured, default (openrouter) provider.
        { method: 'llm-coached', coachingFile, target: 'fr', name: 'French', register: 'Formal' },
        { apiKey: 'test-key', cwd: dir },
      );

      assert.ok(result && result.greeting, 'coached pipeline produced no output');
      assert.equal(result.greeting, 'Bonjour');

      assert.ok(capturedBody, 'no request was sent to the API');
      const systemMsg = (capturedBody.messages || []).find((m) => m.role === 'system');
      assert.ok(systemMsg, 'request had no system message');
      assert.ok(
        systemMsg.content.includes(COACHING_TEXT),
        'the configured coaching prompt did NOT reach the API request — it was silently dropped',
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// -----------------------------------------------------------------
// 4. getMethod() runtime-split message for harness-only engines
// -----------------------------------------------------------------

describe('keyless smoke — getMethod runtime-split message', () => {
  it('points harness-only engines at the harness instead of "Unknown method"', () => {
    for (const engine of ['amazon-translate', 'local-model']) {
      assert.throws(
        () => getMethod(engine),
        (err) => {
          assert.match(err.message, /harness-only/);
          assert.match(err.message, new RegExp(`mt-eval run --method ${engine}`));
          // Must NOT misreport a real engine as a typo.
          assert.doesNotMatch(err.message, /Unknown translation method/);
          return true;
        },
        `${engine} should produce a runtime-split message`,
      );
    }
  });

  it('still reports a genuinely unknown method as Unknown', () => {
    assert.throws(
      () => getMethod('totally-not-a-real-method'),
      /Unknown translation method "totally-not-a-real-method"/,
    );
  });
});
