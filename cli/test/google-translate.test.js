import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { GoogleTranslateMethod, normalizeLocaleForGoogle, describeGoogleError } from '../lib/methods/google-translate.js';

// -----------------------------------------------------------------
// Tests: GoogleTranslateMethod — unit tests (no real API calls)
// -----------------------------------------------------------------

describe('GoogleTranslateMethod', () => {
  it('constructor sets correct method name', () => {
    const method = new GoogleTranslateMethod();
    assert.equal(method.name, 'google-translate');
  });

  it('getQualityTier returns standard', () => {
    const method = new GoogleTranslateMethod();
    assert.equal(method.getQualityTier(), 'standard');
  });

  it('getProvenance returns Google Cloud info', () => {
    const method = new GoogleTranslateMethod();
    const prov = method.getProvenance();
    assert.equal(prov.commercialReady, true);
    assert.equal(prov.resources.length, 1);
    assert.ok(prov.resources[0].name.includes('Google'));
  });

  it('estimateCost returns a valid cost object', () => {
    const method = new GoogleTranslateMethod();
    const cost = method.estimateCost(1000);
    assert.equal(cost.currency, 'USD');
    assert.ok(cost.estimatedCost > 0);
    assert.ok(cost.estimatedCost < 1); // 1000 keys should be well under $1
  });

  it('translate returns null when no API key is set', async () => {
    // Ensure the env var is not set for this test
    const original = process.env.GOOGLE_TRANSLATE_API_KEY;
    delete process.env.GOOGLE_TRANSLATE_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const method = new GoogleTranslateMethod();
    const result = await method.translate(
      ['hello.world'],
      { 'hello.world': 'Hello' },
      { target: 'fr', source: 'en' },
      {},
    );
    assert.equal(result, null);

    // Restore env
    if (original) process.env.GOOGLE_TRANSLATE_API_KEY = original;
  });

  it('translateContent returns null (not supported)', async () => {
    const method = new GoogleTranslateMethod();
    const result = await method.translateContent('some prompt', {}, {});
    assert.equal(result, null);
  });
});

// -----------------------------------------------------------------
// Tests: normalizeLocaleForGoogle
// -----------------------------------------------------------------

describe('normalizeLocaleForGoogle', () => {
  it('maps Hebrew he to iw for Google API', () => {
    assert.equal(normalizeLocaleForGoogle('he'), 'iw');
  });

  it('maps Javanese jv to jw for Google API', () => {
    assert.equal(normalizeLocaleForGoogle('jv'), 'jw');
  });

  it('passes through standard locale codes unchanged', () => {
    assert.equal(normalizeLocaleForGoogle('fr'), 'fr');
    assert.equal(normalizeLocaleForGoogle('de'), 'de');
    assert.equal(normalizeLocaleForGoogle('zh-TW'), 'zh-TW');
    assert.equal(normalizeLocaleForGoogle('ja'), 'ja');
  });
});

// -----------------------------------------------------------------
// Tests: describeGoogleError (M6) — Google returns HTTP 400 for BOTH an
// invalid API key and an unsupported language pair. The classifier must
// parse the response body so the CLI names the real cause instead of
// telling the user to "check billing/quota".
// -----------------------------------------------------------------

describe('describeGoogleError (Google 400 body classification)', () => {
  const API_KEY_INVALID_BODY = JSON.stringify({
    error: {
      code: 400,
      message: 'API key not valid. Please pass a valid API key.',
      status: 'INVALID_ARGUMENT',
      errors: [{ message: 'API key not valid. Please pass a valid API key.', reason: 'API_KEY_INVALID' }],
    },
  });

  const BAD_LANGUAGE_PAIR_BODY = JSON.stringify({
    error: {
      code: 400,
      message: 'Bad language pair: en|crk',
      status: 'INVALID_ARGUMENT',
      errors: [{ message: 'Bad language pair: en|crk', reason: 'invalid' }],
    },
  });

  it('maps API_KEY_INVALID to a key-not-valid message (not billing/quota)', () => {
    const msg = describeGoogleError(400, API_KEY_INVALID_BODY);
    assert.match(msg, /API key not valid/i);
    assert.match(msg, /GOOGLE_TRANSLATE_API_KEY/);
    // Must NOT misdirect the user toward billing — the key value is the problem.
    assert.doesNotMatch(msg, /billing|quota/i);
  });

  it('maps a "Bad language pair" 400 to an unsupported-pair message', () => {
    const msg = describeGoogleError(400, BAD_LANGUAGE_PAIR_BODY);
    assert.match(msg, /unsupported language pair/i);
    assert.doesNotMatch(msg, /billing|quota|api key/i);
  });

  it('degrades gracefully on a non-JSON body', () => {
    const msg = describeGoogleError(400, '<html>Bad Request</html>');
    assert.match(msg, /^400 —/);
    assert.match(msg, /Bad Request/);
  });

  it('surfaces the parsed message for other JSON errors', () => {
    const body = JSON.stringify({ error: { code: 400, message: 'Some other problem' } });
    const msg = describeGoogleError(400, body);
    assert.match(msg, /Some other problem/);
  });
});

// -----------------------------------------------------------------
// Integration: translate() routes a 400 through describeGoogleError so the
// user-facing error names the real cause. (Regression for M6.)
// -----------------------------------------------------------------

describe('GoogleTranslateMethod.translate — 400 error surfacing', () => {
  const originalFetch = globalThis.fetch;
  let originalConsoleError;
  let captured;

  function run400Test(body) {
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      text: async () => body,
      json: async () => JSON.parse(body),
    });
  }

  // Capture stderr (output.error → console.error)
  function startCapture() {
    captured = [];
    originalConsoleError = console.error;
    console.error = (...args) => captured.push(args.join(' '));
  }
  function stopCapture() {
    console.error = originalConsoleError;
  }

  it('reports an invalid API key on a 400 API_KEY_INVALID body', async () => {
    run400Test(JSON.stringify({
      error: { message: 'API key not valid. Please pass a valid API key.',
        errors: [{ reason: 'API_KEY_INVALID' }] },
    }));
    startCapture();
    try {
      const method = new GoogleTranslateMethod();
      const result = await method.translate(
        ['greeting'],
        { greeting: 'Hello' },
        { target: 'fr', source: 'en' },
        { googleApiKey: 'bad-key' },
      );
      assert.equal(result, null);
    } finally {
      stopCapture();
      globalThis.fetch = originalFetch;
    }
    const joined = captured.join('\n');
    assert.match(joined, /API key not valid/i);
    assert.doesNotMatch(joined, /billing|quota/i);
  });

  it('reports an unsupported pair on a 400 "Bad language pair" body', async () => {
    run400Test(JSON.stringify({
      error: { message: 'Bad language pair: en|crk', errors: [{ reason: 'invalid' }] },
    }));
    startCapture();
    try {
      const method = new GoogleTranslateMethod();
      const result = await method.translate(
        ['greeting'],
        { greeting: 'Hello' },
        { target: 'crk', source: 'en' },
        { googleApiKey: 'some-key' },
      );
      assert.equal(result, null);
    } finally {
      stopCapture();
      globalThis.fetch = originalFetch;
    }
    const joined = captured.join('\n');
    assert.match(joined, /unsupported language pair/i);
  });
});
