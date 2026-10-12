/**
 * Request capture — see the exact request a method would send, without
 * sending it (`champollion sync --dry --show-prompt [key]`).
 *
 * WHY: nothing showed whether a gettext `msgctxt`, a `#.` comment or any
 * other per-key instruction actually reaches the model (Round 5, Django
 * persona). Rebuilding "what the prompt probably looks like" beside the real
 * code would be a second prompt builder that drifts; instead the methods'
 * own transports hand their finished request here, at the point where they
 * would call fetch(), and return as if the call failed — no retry, nothing
 * sent, nothing billed.
 *
 * Scoped with AsyncLocalStorage: only code running inside captureRequests()
 * is captured, so a capture never swallows an unrelated call. Inside a
 * capture, fetch() itself is refused (defence in depth: a path that is not
 * hooked fails closed instead of reaching the network).
 *
 * Secrets are redacted before anything is recorded: authorization-type
 * headers and key-bearing URL parameters print as <redacted>.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage();

/** The key a preview passes when none is configured (it never leaves the process). */
export const PREVIEW_KEY = 'preview-no-key';

const SECRET_HEADERS = new Set([
  'authorization', 'x-api-key', 'api-key', 'x-goog-api-key', 'ocp-apim-subscription-key',
  'x-champollion-key', 'proxy-authorization', 'cookie',
]);
const SECRET_PARAMS = new Set(['key', 'api_key', 'apikey', 'token', 'access_token', 'auth_key']);

function redactHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[k] = SECRET_HEADERS.has(k.toLowerCase()) ? '<redacted>' : v;
  }
  return out;
}

function redactUrl(url) {
  try {
    const u = new URL(String(url));
    for (const name of [...u.searchParams.keys()]) {
      if (SECRET_PARAMS.has(name.toLowerCase())) u.searchParams.set(name, '<redacted>');
    }
    return u.toString().replace(/%3Credacted%3E/g, '<redacted>');
  } catch {
    return String(url);
  }
}

/** True inside captureRequests(): the caller must record, not send. */
export function isCapturing() {
  return store.getStore() !== undefined;
}

/**
 * Record the request a transport is about to send. Returns true when it was
 * captured (the transport must then return without calling fetch), false
 * when no capture is active (send as normal).
 *
 * @param {{ url: string, method?: string, headers?: object, body?: unknown }} request
 * @returns {boolean}
 */
export function captureRequest({ url, method = 'POST', headers = {}, body }) {
  const sink = store.getStore();
  if (!sink) return false;
  let parsed = body;
  if (typeof body === 'string') {
    try { parsed = JSON.parse(body); } catch { parsed = body; }
  }
  sink.push({ url: redactUrl(url), method, headers: redactHeaders(headers), body: parsed });
  return true;
}

let fetchGuarded = false;
/** Inside a capture fetch() is refused; outside, it is the real fetch. Installed once. */
function guardFetch() {
  if (fetchGuarded || typeof globalThis.fetch !== 'function') return;
  const realFetch = globalThis.fetch;
  globalThis.fetch = function guardedFetch(...args) {
    if (store.getStore()) {
      return Promise.reject(new Error('request preview: nothing is sent while showing a request'));
    }
    return realFetch.apply(this, args);
  };
  fetchGuarded = true;
}

/**
 * Run fn with capture on; return the requests its transports would have sent.
 *
 * @param {() => Promise<unknown>} fn
 * @returns {Promise<Array<{ url: string, method: string, headers: object, body: unknown }>>}
 */
export async function captureRequests(fn) {
  guardFetch();
  const sink = [];
  await store.run(sink, fn);
  return sink;
}
