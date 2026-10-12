/**
 * fetchWithRetry — shared HTTP fetch with timeout, retry, and backoff.
 *
 * WHY THIS EXISTS:
 *   Every non-LLM method adapter (Google Translate, DeepL, Microsoft,
 *   LibreTranslate) was independently implementing the same ~50-line retry
 *   loop: AbortController + timeout, isRetryable() check, exponential
 *   backoff with jitter, and error logging. When a bug was fixed in one
 *   adapter's retry logic, the others wouldn't get the fix.
 *
 *   This module extracts that shared pattern into a single function so
 *   retry behavior is consistent and bug fixes propagate automatically.
 *
 * ⚠️  MAINTENANCE NOTE FOR FUTURE DEVELOPERS:
 *     If you're adding a new translation method that uses a REST API,
 *     use this function instead of writing your own retry loop.
 *     If you need custom retry behavior (e.g., the LLM cascade in
 *     direct-llm.js), extend this or document why your case is different.
 *
 * WHAT THIS HANDLES:
 *   - AbortController + configurable per-request timeout
 *   - Retryable status detection (429, 5xx) via isRetryable()
 *   - Exponential backoff with jitter via getBackoffDelay()
 *   - Timeout (AbortError) retries
 *   - Consistent error logging format
 *
 * WHAT THIS DOES NOT HANDLE (method-specific):
 *   - Response body parsing (JSON structure varies per provider)
 *   - Key mapping (ordered arrays → key-value maps)
 *   - Glossary creation, formality parameters, locale normalization
 *   - Prompt building
 *
 * RETURN CONTRACT:
 *   - Returns the raw Response object for ANY non-retryable status (2xx, 400, 401, etc.)
 *   - Returns null ONLY when all retries are exhausted on retryable errors (429, 5xx)
 *   - This lets callers handle method-specific error cases (e.g., DeepL's glossary-400)
 */

import {
  MAX_RETRIES,
  isRetryable,
  getBackoffDelay,
  sleep,
} from './http-utils.js';
import { output } from '../output.js';
import { recordTranslationError } from './translation-error.js';

/**
 * Fetch a URL with automatic retry, timeout, and exponential backoff.
 *
 * @param {string} url - Endpoint URL
 * @param {object} fetchOptions - Standard fetch() options (method, headers, body).
 *   Do NOT include a 'signal' property — one will be created from the timeout.
 * @param {object} [retryOptions={}]
 * @param {string} retryOptions.label - Log label for error messages (e.g., 'DeepL batch 3')
 * @param {number} [retryOptions.timeoutMs=30000] - Per-request timeout in milliseconds
 * @param {number} [retryOptions.maxRetries] - Max retry attempts (defaults to MAX_RETRIES from http-utils)
 * @param {number} [retryOptions.startAttempt=0] - Starting attempt number.
 *   Used to share retry budgets across recursive calls (e.g., DeepL glossary fallback).
 * @returns {Promise<Response|null>} Fetch Response on any non-retryable status, null on retry exhaustion
 */
async function fetchWithRetry(url, fetchOptions, retryOptions = {}) {
  const {
    label = 'HTTP',
    timeoutMs = 30000,
    maxRetries = MAX_RETRIES,
    startAttempt = 0,
  } = retryOptions;

  for (let attempt = startAttempt; attempt <= maxRetries; attempt++) {
    try {
      // Each attempt gets a fresh AbortController so the timeout resets.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Retryable status (429 Too Many Requests, 5xx Server Error):
      // back off and try again, unless we've exhausted all attempts.
      if (isRetryable(response.status)) {
        if (attempt < maxRetries) {
          const delay = getBackoffDelay(attempt);
          output.warn(`⏳ ${label}: ${response.status} — retrying in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        output.error(`${label}: ${response.status} after ${maxRetries + 1} attempts`);
        recordTranslationError(response.status);
        return null;
      }

      // Any non-retryable response (2xx, 400, 401, 403, 404, etc.):
      // return to caller for method-specific handling. Record non-2xx
      // statuses centrally so every fetchWithRetry-based provider's
      // getSetupHelp() can tell an auth failure (401/403) from quota.
      if (!response.ok) recordTranslationError(response.status);
      return response;

    } catch (err) {
      // AbortError = our timeout fired. Other errors = network failure, DNS, etc.
      const isTimeout = err.name === 'AbortError';
      const errLabel = isTimeout ? 'Timeout' : err.message;

      if (attempt < maxRetries) {
        const delay = getBackoffDelay(attempt);
        output.warn(`⏳ ${label}: ${errLabel} — retrying in ${Math.round(delay / 1000)}s...`);
        await sleep(delay);
        continue;
      }

      output.error(`${label}: ${errLabel} after ${maxRetries + 1} attempts`);
      return null;
    }
  }

  return null;
}

export { fetchWithRetry };
