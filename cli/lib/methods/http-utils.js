/**
 * Shared HTTP utilities for translation methods.
 *
 * WHY THIS EXISTS:
 *   Every translation method (LLM, coached, Google, API) needs the same
 *   retry logic: exponential backoff with jitter, retryable status detection,
 *   and an async sleep helper. Before this module, these were copy-pasted
 *   identically across 4 files — a maintenance hazard where a bug fix in
 *   one copy wouldn't propagate to the others.
 *
 * WHAT'S SHARED:
 *   - Constants: MAX_RETRIES, BASE_DELAY_MS, REQUEST_TIMEOUT_MS
 *   - isRetryable(status)    — should this HTTP status trigger a retry?
 *   - getBackoffDelay(attempt) — exponential backoff with random jitter
 *   - sleep(ms)              — promise-based delay
 *   - stripCodeFences(text)  — remove markdown code fences from LLM responses
 *
 * WHAT'S NOT SHARED:
 *   - Prompt building (method-specific)
 *   - Response validation (method-specific key filtering)
 *   - Endpoint URLs (method-specific)
 */

// -----------------------------------------------------------------
// Retry constants
// -----------------------------------------------------------------

/** Maximum number of retry attempts after the initial request */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (doubles each attempt) */
const BASE_DELAY_MS = 1000;

/** Default request timeout — aborts if no response within this window */
const REQUEST_TIMEOUT_MS = 30000;

// -----------------------------------------------------------------
// Retry utilities
// -----------------------------------------------------------------

/**
 * Check if an HTTP status code should trigger a retry.
 *
 * Retries on:
 *   - 429 (Too Many Requests) — rate limiting, always transient
 *   - 5xx (Server Error) — server-side issues, often transient
 *
 * Does NOT retry on:
 *   - 4xx (Client Error) — our request is wrong, retrying won't help
 *   - 2xx (Success) — obviously
 *
 * @param {number} status - HTTP status code
 * @returns {boolean} True if the request should be retried
 */
function isRetryable(status) {
  return status === 429 || status >= 500;
}

/**
 * Calculate backoff delay with jitter for a given retry attempt.
 *
 * Formula: (BASE_DELAY_MS × 2^attempt) + random(0..500ms)
 *
 * Examples:
 *   attempt 0 → 1000-1500ms
 *   attempt 1 → 2000-2500ms
 *   attempt 2 → 4000-4500ms
 *
 * The jitter prevents thundering herd when multiple requests
 * hit a rate limit simultaneously.
 *
 * @param {number} attempt - Zero-based retry attempt number
 * @returns {number} Delay in milliseconds
 */
function getBackoffDelay(attempt) {
  const base = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 500;
  return base + jitter;
}

/**
 * Promise-based sleep utility.
 *
 * @param {number} ms - Duration to sleep in milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -----------------------------------------------------------------
// Response parsing utilities
// -----------------------------------------------------------------

/**
 * Strip markdown code fences from LLM response text.
 *
 * LLMs frequently wrap JSON responses in ```json ... ``` blocks
 * even when instructed not to. This strips those fences so the
 * response can be parsed as raw JSON.
 *
 * Handles both ```json and bare ``` fences.
 *
 * @param {string} text - Raw LLM response text (already trimmed)
 * @returns {string} Text with code fences removed
 */
function stripCodeFences(text) {
  return text
    .replace(/^```(?:json|markdown|md)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

/**
 * True only when an endpoint provably stays on this machine — the same rule
 * as the harness's LocalProvider.is_loopback_endpoint(): unix sockets,
 * `localhost` (and `*.localhost`), loopback IPs (127.0.0.0/8, ::1) and the
 * unspecified addresses 0.0.0.0 / :: (a client connecting to them reaches
 * this host). A LAN or private-range address is another machine: false.
 *
 * Used to price a model served here as "$0 API cost (runs on this machine)"
 * instead of "unknown" — never for an endpoint that only might be local.
 *
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
function isLoopbackEndpoint(url) {
  if (!url || typeof url !== 'string') return false;
  if (/^(?:http\+)?unix:/i.test(url)) return true;
  let host;
  try { host = new URL(url.includes('//') ? url : `http://${url}`).hostname; } catch { return false; }
  host = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (/^127(?:\.\d{1,3}){3}$/.test(host)) return host.split('.').every(o => Number(o) <= 255);
  if (host === '0.0.0.0' || host === '::1' || host === '::') return true;
  // IPv4-mapped IPv6 loopback (::ffff:127.0.0.1 → URL writes ::ffff:7f00:1).
  if (/^::ffff:(?:127(?:\.\d{1,3}){3}|7f[0-9a-f]{2}:[0-9a-f]{1,4})$/.test(host)) return true;
  return false;
}

/** The cost estimate for a model served on this machine (see isLoopbackEndpoint). */
function localMachineCost(endpoint) {
  return {
    estimatedCost: 0,
    currency: 'USD',
    source: 'local-machine',
    local: true,
    note: `$0 API cost — runs on this machine (${endpoint}); your own hardware and power are not counted.`,
  };
}

export {
  isLoopbackEndpoint,
  localMachineCost,
  MAX_RETRIES,
  BASE_DELAY_MS,
  REQUEST_TIMEOUT_MS,
  isRetryable,
  getBackoffDelay,
  sleep,
  stripCodeFences,
};
