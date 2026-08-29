// docentClient.js — thin browser client for the site docent's two edge
// functions. Mirrors the hardcoded-project-URL pattern already used by
// liveQueue.js / languageLoader.js (the public anon project).
//
// Both functions are deployed with verify_jwt disabled and CORS locked to the
// site origins, so no auth header is needed from the browser.

const SUPABASE_URL = 'https://sjdomynysdljkbemupqa.supabase.co';
const FUNCTIONS = `${SUPABASE_URL}/functions/v1`;

/** Ask the docent a question.
 * @param {{message:string, history?:Array<{role:string,content:string}>, locale?:string, register?:string}} payload
 * @returns {Promise<{ok:boolean, mode?:string, degraded_reason?:string, answer?:string, sources?:Array<{title:string,url:string}>, error?:string, retry_after_seconds?:number}>}
 */
export async function askDocent(payload, { signal } = {}) {
  try {
    const resp = await fetch(`${FUNCTIONS}/docent-chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        ok: false,
        error: errorTextFrom(data, resp.status),
        status: resp.status,
        retry_after_seconds: data.retry_after_seconds,
      };
    }
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return { ok: false, error: 'network error — please try again.', status: 0 };
  }
}

/** Turn a failed response into something a visitor can act on.
 *
 * Our own handlers return `{error}`. The platform does NOT: an undeployed or
 * unreachable function answers `{"code":"NOT_FOUND","message":"Requested
 * function was not found"}`, which has no `error` key at all — so reading only
 * `error` used to collapse every such failure into the bare string "request
 * failed (404)". Read both shapes, and say plainly when the backend simply
 * isn't answering rather than echoing a status code at the visitor.
 */
function errorTextFrom(data, status) {
  if (data.error) return data.error;
  if (status === 404 || status === 502 || status === 503) {
    return 'the guide service is not reachable right now.';
  }
  return data.message || `request failed (${status})`;
}

/** File a ticket (question / objection / correction / takedown).
 * @param {{message:string, kind?:string, contact_email?:string, locale?:string, page_url?:string, source?:string}} payload
 * @returns {Promise<{ok:boolean, id?:(number|string), emailed?:boolean, message?:string, error?:string}>}
 */
export async function submitTicket(payload) {
  try {
    const resp = await fetch(`${FUNCTIONS}/submit-ticket`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'docent-form', ...payload }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: errorTextFrom(data, resp.status), status: resp.status };
    }
    return data;
  } catch {
    return {
      ok: false,
      error: 'network error — please try again, or email info@champollion.dev.',
      status: 0,
    };
  }
}
