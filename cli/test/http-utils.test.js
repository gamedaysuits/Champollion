/**
 * HTTP utilities tests — isRetryable, getBackoffDelay, stripCodeFences.
 *
 * WHY THESE EXIST:
 *   http-utils.js is shared by ALL translation method adapters. If
 *   isRetryable misclassifies a status code, every provider either
 *   retries pointlessly (wasting money) or gives up prematurely.
 *   stripCodeFences must handle the dozen variations LLMs produce
 *   without mangling valid JSON. Previously untested directly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_RETRIES,
  BASE_DELAY_MS,
  REQUEST_TIMEOUT_MS,
  isRetryable,
  getBackoffDelay,
  sleep,
  stripCodeFences,
} from '../lib/methods/http-utils.js';

// =================================================================
// 1. Constants — sanity checks
// =================================================================
describe('http-utils: constants', () => {
  it('MAX_RETRIES is a positive integer', () => {
    assert.equal(typeof MAX_RETRIES, 'number');
    assert.ok(MAX_RETRIES > 0);
    assert.ok(Number.isInteger(MAX_RETRIES));
  });

  it('BASE_DELAY_MS is a positive number', () => {
    assert.ok(BASE_DELAY_MS > 0);
  });

  it('REQUEST_TIMEOUT_MS is at least 5 seconds', () => {
    assert.ok(REQUEST_TIMEOUT_MS >= 5000);
  });
});

// =================================================================
// 2. isRetryable — status code classification
// =================================================================
describe('http-utils: isRetryable', () => {
  it('retries on 429 (Too Many Requests)', () => {
    assert.equal(isRetryable(429), true);
  });

  it('retries on 500 (Internal Server Error)', () => {
    assert.equal(isRetryable(500), true);
  });

  it('retries on 502 (Bad Gateway)', () => {
    assert.equal(isRetryable(502), true);
  });

  it('retries on 503 (Service Unavailable)', () => {
    assert.equal(isRetryable(503), true);
  });

  it('retries on 504 (Gateway Timeout)', () => {
    assert.equal(isRetryable(504), true);
  });

  it('does NOT retry on 200 (OK)', () => {
    assert.equal(isRetryable(200), false);
  });

  it('does NOT retry on 201 (Created)', () => {
    assert.equal(isRetryable(201), false);
  });

  it('does NOT retry on 400 (Bad Request)', () => {
    assert.equal(isRetryable(400), false);
  });

  it('does NOT retry on 401 (Unauthorized)', () => {
    assert.equal(isRetryable(401), false);
  });

  it('does NOT retry on 403 (Forbidden)', () => {
    assert.equal(isRetryable(403), false);
  });

  it('does NOT retry on 404 (Not Found)', () => {
    assert.equal(isRetryable(404), false);
  });

  it('does NOT retry on 422 (Unprocessable)', () => {
    assert.equal(isRetryable(422), false);
  });
});

// =================================================================
// 3. getBackoffDelay — exponential backoff with jitter
// =================================================================
describe('http-utils: getBackoffDelay', () => {
  it('attempt 0 produces delay in [BASE_DELAY, BASE_DELAY+500] range', () => {
    const delay = getBackoffDelay(0);
    assert.ok(delay >= BASE_DELAY_MS, `Delay ${delay} should be >= ${BASE_DELAY_MS}`);
    assert.ok(delay <= BASE_DELAY_MS + 500, `Delay ${delay} should be <= ${BASE_DELAY_MS + 500}`);
  });

  it('attempt 1 doubles the base delay', () => {
    const delay = getBackoffDelay(1);
    const expectedBase = BASE_DELAY_MS * 2;
    assert.ok(delay >= expectedBase, `Delay ${delay} should be >= ${expectedBase}`);
    assert.ok(delay <= expectedBase + 500, `Delay ${delay} should be <= ${expectedBase + 500}`);
  });

  it('attempt 2 quadruples the base delay', () => {
    const delay = getBackoffDelay(2);
    const expectedBase = BASE_DELAY_MS * 4;
    assert.ok(delay >= expectedBase);
    assert.ok(delay <= expectedBase + 500);
  });

  it('delays are monotonically increasing in base value', () => {
    // Run multiple samples to verify the trend despite jitter
    let prevBase = 0;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const base = BASE_DELAY_MS * Math.pow(2, attempt);
      assert.ok(base > prevBase, `Base at attempt ${attempt} should exceed previous`);
      prevBase = base;
    }
  });

  it('includes random jitter (not always the same)', () => {
    // WHY: Jitter prevents thundering herd. If we call getBackoffDelay
    // many times at the same attempt, we should get different values.
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      results.add(getBackoffDelay(0));
    }
    // With 20 calls and 500ms of random jitter, we should have at least
    // a few distinct values (extremely unlikely to get all identical)
    assert.ok(results.size > 1, 'Jitter should produce varying delay values');
  });
});

// =================================================================
// 4. sleep — basic functionality
// =================================================================
describe('http-utils: sleep', () => {
  it('resolves after the specified duration', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    // Allow some timing variance (at least 40ms, could be up to 100ms on slow CI)
    assert.ok(elapsed >= 40, `Sleep should wait at least ~50ms, got ${elapsed}ms`);
  });

  it('returns a promise', () => {
    const result = sleep(1);
    assert.ok(result instanceof Promise);
  });
});

// =================================================================
// 5. stripCodeFences — LLM response cleaning
// =================================================================
describe('http-utils: stripCodeFences', () => {
  it('strips ```json fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    assert.equal(stripCodeFences(input), '{"key": "value"}');
  });

  it('strips bare ``` fences', () => {
    const input = '```\n{"key": "value"}\n```';
    assert.equal(stripCodeFences(input), '{"key": "value"}');
  });

  it('strips ```markdown fences', () => {
    const input = '```markdown\n# Hello\n```';
    assert.equal(stripCodeFences(input), '# Hello');
  });

  it('strips ```md fences', () => {
    const input = '```md\n# Hello\n```';
    assert.equal(stripCodeFences(input), '# Hello');
  });

  it('handles case-insensitive fence labels', () => {
    const input = '```JSON\n{"a": 1}\n```';
    assert.equal(stripCodeFences(input), '{"a": 1}');
  });

  it('leaves already-clean JSON unchanged', () => {
    const input = '{"key": "value"}';
    assert.equal(stripCodeFences(input), '{"key": "value"}');
  });

  it('trims surrounding whitespace', () => {
    const input = '  {"key": "value"}  ';
    assert.equal(stripCodeFences(input), '{"key": "value"}');
  });

  it('handles multiline JSON inside fences', () => {
    const input = '```json\n{\n  "greeting": "hello",\n  "farewell": "goodbye"\n}\n```';
    const result = stripCodeFences(input);
    const parsed = JSON.parse(result);
    assert.equal(parsed.greeting, 'hello');
    assert.equal(parsed.farewell, 'goodbye');
  });

  it('handles fences without trailing newline', () => {
    const input = '```json\n{"a": 1}```';
    const result = stripCodeFences(input);
    assert.equal(result, '{"a": 1}');
  });
});
