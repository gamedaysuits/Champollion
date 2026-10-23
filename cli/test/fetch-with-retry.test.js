/**
 * fetchWithRetry tests — shared HTTP fetch with timeout, retry, and backoff.
 *
 * WHY THESE EXIST:
 *   fetchWithRetry is the single retry implementation shared by ALL non-LLM
 *   method adapters (Google, DeepL, Microsoft, LibreTranslate). A bug here
 *   affects every provider. These tests verify the return contract:
 *     - Returns Response for non-retryable statuses (2xx, 4xx)
 *     - Returns null when retries are exhausted on retryable statuses (429, 5xx)
 *     - Respects startAttempt for shared retry budgets (DeepL glossary fallback)
 *     - Handles timeouts (AbortError) and network errors
 *
 *   Uses globalThis.fetch mock — no real network calls.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { fetchWithRetry } from '../lib/methods/fetch-with-retry.js';

// =================================================================
// Mock infrastructure
// =================================================================

/** Save the original fetch so we can restore it after each test. */
const originalFetch = globalThis.fetch;

/**
 * Create a mock fetch that returns predefined responses in sequence.
 *
 * @param {Array<object|Error>} responses - Each item is either:
 *   - { status, ok, body } for a successful HTTP response
 *   - An Error to throw (simulates network failure)
 * @returns {Function} Mock fetch function
 */
function mockFetch(responses) {
  let callIndex = 0;
  const calls = [];

  const mock = async (url, options) => {
    calls.push({ url, options });
    const item = responses[Math.min(callIndex++, responses.length - 1)];

    if (item instanceof Error) {
      throw item;
    }

    return {
      status: item.status,
      ok: item.status >= 200 && item.status < 300,
      text: async () => item.body || '',
      json: async () => JSON.parse(item.body || '{}'),
      headers: new Headers(),
    };
  };

  mock.calls = calls;
  return mock;
}

// Suppress console.error during tests to avoid noisy retry log messages
let errorSpy;
beforeEach(() => {
  errorSpy = console.error;
  console.error = () => {};
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.error = errorSpy;
});

// =================================================================
// 1. Success path — 2xx responses
// =================================================================
describe('fetchWithRetry: success path', () => {
  it('returns Response on 200 OK', async () => {
    globalThis.fetch = mockFetch([
      { status: 200, body: '{"result": "ok"}' },
    ]);

    const response = await fetchWithRetry('https://api.example.com/translate', {
      method: 'POST',
      body: '{}',
    }, {
      label: 'test',
      maxRetries: 2,
    });

    assert.ok(response, 'Should return a Response object');
    assert.equal(response.status, 200);
    assert.equal(response.ok, true);
  });

  it('returns Response on 201 Created', async () => {
    globalThis.fetch = mockFetch([
      { status: 201, body: '{}' },
    ]);

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 1,
    });

    assert.equal(response.status, 201);
  });
});

// =================================================================
// 2. Non-retryable errors — returned to caller for method-specific handling
// =================================================================
describe('fetchWithRetry: non-retryable errors', () => {
  it('returns Response on 400 Bad Request (not retried)', async () => {
    // WHY: DeepL uses 400 to signal glossary incompatibility — the caller
    // must inspect the response, not have it retried away.
    const mock = mockFetch([
      { status: 400, body: '{"error": "bad glossary"}' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 3,
    });

    assert.ok(response, 'Should return response, not null');
    assert.equal(response.status, 400);
    assert.equal(mock.calls.length, 1, 'Should NOT retry on 400');
  });

  it('returns Response on 401 Unauthorized (not retried)', async () => {
    const mock = mockFetch([
      { status: 401, body: 'invalid key' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 3,
    });

    assert.equal(response.status, 401);
    assert.equal(mock.calls.length, 1, 'Should NOT retry on 401');
  });

  it('returns Response on 403 Forbidden (not retried)', async () => {
    const mock = mockFetch([
      { status: 403, body: 'forbidden' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 3,
    });

    assert.equal(response.status, 403);
    assert.equal(mock.calls.length, 1);
  });

  it('returns Response on 404 Not Found (not retried)', async () => {
    const mock = mockFetch([
      { status: 404, body: 'not found' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 3,
    });

    assert.equal(response.status, 404);
    assert.equal(mock.calls.length, 1);
  });
});

// =================================================================
// 3. Retryable errors — 429 and 5xx should retry, then exhaust
// =================================================================
describe('fetchWithRetry: retryable errors', () => {
  it('retries on 429 and succeeds on second attempt', async () => {
    const mock = mockFetch([
      { status: 429, body: 'rate limited' },
      { status: 200, body: '{"ok": true}' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 2,
    });

    assert.ok(response, 'Should eventually return success');
    assert.equal(response.status, 200);
    assert.equal(mock.calls.length, 2, 'Should have retried once');
  });

  it('retries on 500 and succeeds on third attempt', async () => {
    const mock = mockFetch([
      { status: 500, body: 'server error' },
      { status: 502, body: 'bad gateway' },
      { status: 200, body: '{"ok": true}' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 3,
    });

    assert.ok(response);
    assert.equal(response.status, 200);
    assert.equal(mock.calls.length, 3);
  });

  it('returns null when all retries exhausted on 429', async () => {
    const mock = mockFetch([
      { status: 429, body: 'rate limited' },
      { status: 429, body: 'rate limited' },
      { status: 429, body: 'rate limited' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 2,
    });

    assert.equal(response, null, 'Should return null after exhausting retries');
    assert.equal(mock.calls.length, 3, 'Should have made maxRetries + 1 attempts');
  });

  it('returns null when all retries exhausted on 503', async () => {
    const mock = mockFetch([
      { status: 503, body: 'unavailable' },
      { status: 503, body: 'unavailable' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 1,
    });

    assert.equal(response, null);
    assert.equal(mock.calls.length, 2);
  });
});

// =================================================================
// 4. startAttempt — shared retry budget
// =================================================================
describe('fetchWithRetry: startAttempt (shared retry budget)', () => {
  it('starts counting from startAttempt, reducing available retries', async () => {
    // WHY: DeepL glossary fallback passes startAttempt to prevent
    // the recursive call from getting a fresh budget of MAX_RETRIES.
    const mock = mockFetch([
      { status: 429, body: 'rate limited' },
      { status: 429, body: 'rate limited' },
      { status: 429, body: 'rate limited' },
    ]);
    globalThis.fetch = mock;

    // maxRetries=3, startAttempt=2 → only 2 attempts allowed (2 and 3)
    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 3,
      startAttempt: 2,
    });

    assert.equal(response, null);
    assert.equal(mock.calls.length, 2, 'Should only make 2 attempts (attempt 2 and 3)');
  });

  it('startAttempt at maxRetries allows exactly one attempt', async () => {
    const mock = mockFetch([
      { status: 429, body: 'rate limited' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 3,
      startAttempt: 3,
    });

    assert.equal(response, null);
    assert.equal(mock.calls.length, 1, 'At maxRetries, one final attempt then null');
  });

  it('startAttempt beyond maxRetries returns null immediately', async () => {
    const mock = mockFetch([
      { status: 200, body: '{}' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 3,
      startAttempt: 4,
    });

    assert.equal(response, null);
    assert.equal(mock.calls.length, 0, 'Should not even attempt if already past budget');
  });
});

// =================================================================
// 5. Network errors — thrown exceptions
// =================================================================
describe('fetchWithRetry: network errors', () => {
  it('retries on network error and succeeds', async () => {
    const mock = mockFetch([
      new Error('ECONNREFUSED'),
      { status: 200, body: '{"ok": true}' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 2,
    });

    assert.ok(response);
    assert.equal(response.status, 200);
    assert.equal(mock.calls.length, 2);
  });

  it('returns null after exhausting retries on network errors', async () => {
    const mock = mockFetch([
      new Error('ECONNREFUSED'),
      new Error('ECONNREFUSED'),
      new Error('ECONNREFUSED'),
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 2,
    });

    assert.equal(response, null);
    assert.equal(mock.calls.length, 3);
  });
});

// =================================================================
// 6. Timeout (AbortError) handling
// =================================================================
describe('fetchWithRetry: timeout handling', () => {
  it('retries on AbortError (timeout) and succeeds', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    const mock = mockFetch([
      abortError,
      { status: 200, body: '{"ok": true}' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 2,
    });

    assert.ok(response);
    assert.equal(response.status, 200);
  });

  it('returns null after exhausting timeout retries', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    const mock = mockFetch([
      abortError,
      abortError,
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 1,
    });

    assert.equal(response, null);
  });
});

// =================================================================
// 7. Options pass-through
// =================================================================
describe('fetchWithRetry: options pass-through', () => {
  it('forwards method, headers, and body to fetch', async () => {
    const mock = mockFetch([
      { status: 200, body: '{}' },
    ]);
    globalThis.fetch = mock;

    await fetchWithRetry('https://api.example.com/v2/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer xxx' },
      body: JSON.stringify({ text: ['hello'] }),
    }, {
      label: 'test',
      maxRetries: 1,
    });

    const call = mock.calls[0];
    assert.equal(call.url, 'https://api.example.com/v2/translate');
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.headers['Content-Type'], 'application/json');
    assert.equal(call.options.headers['Authorization'], 'Bearer xxx');
    assert.ok(call.options.body.includes('hello'));
  });

  it('attaches an AbortSignal (for timeout control)', async () => {
    const mock = mockFetch([
      { status: 200, body: '{}' },
    ]);
    globalThis.fetch = mock;

    await fetchWithRetry('https://api.example.com', {}, {
      label: 'test',
      maxRetries: 0,
    });

    const call = mock.calls[0];
    assert.ok(call.options.signal, 'Should attach an AbortSignal');
    assert.ok(call.options.signal instanceof AbortSignal, 'Signal should be an AbortSignal instance');
  });

  it('uses default label and timeout when retryOptions omitted', async () => {
    const mock = mockFetch([
      { status: 200, body: '{}' },
    ]);
    globalThis.fetch = mock;

    // Call with no retryOptions at all
    const response = await fetchWithRetry('https://api.example.com', {});

    assert.ok(response);
    assert.equal(response.status, 200);
  });
});

// =================================================================
// 8. Mixed scenarios
// =================================================================
describe('fetchWithRetry: mixed error scenarios', () => {
  it('handles network error → 429 → 200 sequence', async () => {
    const mock = mockFetch([
      new Error('ECONNRESET'),
      { status: 429, body: 'rate limited' },
      { status: 200, body: '{"translated": "hola"}' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'mixed test',
      maxRetries: 3,
    });

    assert.ok(response);
    assert.equal(response.status, 200);
    assert.equal(mock.calls.length, 3);
  });

  it('handles 500 → AbortError → 400 sequence (400 returned, not retried)', async () => {
    const abortError = new Error('timeout');
    abortError.name = 'AbortError';

    const mock = mockFetch([
      { status: 500, body: 'error' },
      abortError,
      { status: 400, body: 'bad request' },
    ]);
    globalThis.fetch = mock;

    const response = await fetchWithRetry('https://api.example.com', {}, {
      label: 'mixed test',
      maxRetries: 3,
    });

    // 400 is non-retryable, so should be returned to caller
    assert.ok(response);
    assert.equal(response.status, 400);
    assert.equal(mock.calls.length, 3);
  });
});
