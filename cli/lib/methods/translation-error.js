/**
 * translation-error.js — shared recorder for the most recent translation
 * HTTP failure, used to give accurate setup help.
 *
 * WHY: When a sync fails, getSetupHelp() previously always said "check your
 * dashboard for quota/billing" — wrong and misleading when the real problem
 * was a bad/expired key (HTTP 401/403). The user burns time checking billing
 * when they should be re-checking the key value.
 *
 * The HTTP clients (openrouter-client, direct-llm, fetch-with-retry) record
 * the status of a failing request here as they give up on it. getSetupHelp()
 * then reads the last-seen failure and tailors its guidance:
 *   - auth   (401/403): the key itself is the problem, not billing
 *   - quota  (429):     rate-limited / over quota → check billing/quota
 *   - server (5xx):     upstream problem → wait and retry
 *
 * The method instance that ran the translation is discarded before
 * getSetupHelp() is called (sync.js builds a fresh instance), so per-instance
 * state can't carry the status across. A module-level "last error" is the
 * pragmatic carrier: failures are almost always systemic (one bad key fails
 * every pair), so the last-recorded status is representative of the failure
 * the user is about to read help for.
 *
 * Node is single-threaded, so the assignment itself never races. Callers that
 * want a clean slate (e.g. the start of a sync run) call reset first.
 */

let _last = null; // { status: number|null, kind: string }

/**
 * Classify an HTTP status into a coarse failure kind.
 *
 * @param {number} status - HTTP status code
 * @returns {'auth'|'quota'|'server'|'unknown'}
 */
function classifyTranslationError(status) {
  if (typeof status !== 'number') return 'unknown';
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'quota';
  if (status >= 500 && status <= 599) return 'server';
  return 'unknown';
}

/**
 * Record a failing HTTP status. No-ops for non-numbers and for 2xx
 * (a successful response is not a failure to report).
 *
 * @param {number} status - HTTP status code of the failed request
 * @returns {{ status: number|null, kind: string }|null} the recorded entry
 */
function recordTranslationError(status) {
  if (typeof status !== 'number' || (status >= 200 && status < 300)) return _last;
  _last = { status, kind: classifyTranslationError(status) };
  return _last;
}

/**
 * Get the most recently recorded translation failure, or null if none.
 *
 * @returns {{ status: number|null, kind: string }|null}
 */
function getLastTranslationError() {
  return _last;
}

/**
 * Clear the recorded failure. Call at the start of a fresh sync run so a
 * stale error from a prior in-process sync (e.g. watch mode) can't leak
 * into the next run's help text.
 */
function resetTranslationError() {
  _last = null;
}

export {
  classifyTranslationError,
  recordTranslationError,
  getLastTranslationError,
  resetTranslationError,
};
