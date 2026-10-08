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

/** What the server says when the live database has not got the flag lane.
 *
 * `kind='flag'` and `tickets.subject_run_card_id` arrive together in migration
 * 074. Against a database without it the insert fails and the edge function
 * hands PostgREST's own words back inside `error` ("column … does not exist",
 * PGRST204/42703, or the kind CHECK 23514). An undeployed function has no
 * `error` key at all and answers 404 NOT_FOUND.
 */
const FLAG_LANE_UNAVAILABLE =
  /subject_run_card_id|tickets_kind_check|PGRST204|42703|23514|does not exist|NOT_FOUND|not found/i;

/** Turn a failed ticket POST into text a visitor can act on.
 *
 * A flag is the one kind that can be refused for a reason the visitor cannot
 * fix and we must not disguise: where the flag lane is not deployed, filing is
 * impossible, not unlucky. Reporting that as "could not send — please try
 * again" would present a lane that is not running as a transient hiccup. Say
 * what happened, quote the server verbatim so the reason is inspectable, and
 * name the route that still works.
 */
export function ticketErrorText(data, status, kind) {
  const serverSaid =
    (typeof data?.error === 'string' && data.error) ||
    (typeof data?.message === 'string' && data.message) ||
    '';
  if (kind === FLAG_KIND && serverSaid && FLAG_LANE_UNAVAILABLE.test(serverSaid)) {
    return (
      'Flagging is not running on this deployment yet, so this flag was not ' +
      `filed. The server said: ${serverSaid} ` +
      'Email info@champollion.dev and the maintainers will pick it up.'
    );
  }
  if (serverSaid) return serverSaid;
  if (status === 404 || status === 502 || status === 503) {
    return `the ticket service is not reachable right now (${status}).`;
  }
  return `request failed (${status})`;
}

// ---------------------------------------------------------------------------
// Community flagging (migration 074, practice 13)
// ---------------------------------------------------------------------------
//
// A reader who believes a published run card is wrong — contaminated corpus,
// gamed metric, misattributed method — files a `flag` ticket naming that
// card's id. Two rules shape everything below:
//
//   1. A flag can only be filed where a run card is IN CONTEXT. There is no
//      "flag something" entry point, because a flag with no subject is not a
//      flag. The leaderboard row that already knows its card id asks for the
//      form; the docent (mounted once, globally, in theme/Root.js) opens it.
//   2. Nothing about flags is ever rendered publicly — no count, no badge, no
//      "3 people flagged this". A count is a gaming surface. The only public
//      consequence of an upheld flag is the card's trust becoming
//      `disqualified`, after the cause is added to the submission rules by a
//      dated edit.

/** The kind that names a run card. Mirrors `FLAG_KIND` in the edge function
 * (`functions/submit-ticket/lib.ts`) and the 074 `tickets_kind_check`. */
export const FLAG_KIND = 'flag';

/** Shape of `tickets.subject_run_card_id` — the SAME rule as the 074 CHECK
 * (`~ '^[0-9a-f-]{36}$'`) and `isRunCardId` in the edge function. */
export const RUN_CARD_ID_PATTERN = /^[0-9a-f-]{36}$/;

/** Is this the shape of a run card id? */
export function isRunCardId(value) {
  return typeof value === 'string' && RUN_CARD_ID_PATTERN.test(value);
}

/** The window event a run-card view dispatches to ask the docent to open its
 * flag form. An event rather than a prop because the docent is mounted once at
 * the app root and the run-card views are pages below it — this is the minimal
 * seam that keeps the flag form in one place. */
export const FLAG_REQUEST_EVENT = 'champollion:flag-run-card';

/** Ask the docent to open a flag form for one run card.
 *
 * @param {{runCardId:string, label?:string}} subject
 * @returns {boolean} true when the request was dispatched. Refuses (returns
 *   false, logs) on a malformed id rather than opening a form that cannot be
 *   submitted — the caller should not render the affordance at all for a row
 *   with no id.
 */
export function requestRunCardFlag({runCardId, label} = {}) {
  if (!isRunCardId(runCardId)) {
    console.error(
      `[docent] refusing to open a flag form: ${JSON.stringify(runCardId)} is ` +
        'not a run card id',
    );
    return false;
  }
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(
    new CustomEvent(FLAG_REQUEST_EVENT, {detail: {runCardId, label: label || ''}}),
  );
  return true;
}

/** The exact body a flag POSTs — the one place the flag payload is built, so
 * the client half of the contract is testable without a network.
 *
 * @param {{runCardId:string, message:string, contactEmail?:string, locale?:string, pageUrl?:string, source?:string}} input
 * @returns {{kind:string, subject_run_card_id:string, message:string, contact_email?:string, locale?:string, page_url?:string, source:string}}
 */
export function buildFlagPayload({
  runCardId,
  message,
  contactEmail,
  locale,
  pageUrl,
  // One name for this door, so triage can tell a flag from the general
  // contact form at a glance (the server defaults everything else to
  // 'docent-form').
  source = 'docent-flag',
}) {
  if (!isRunCardId(runCardId)) {
    throw new Error(`flag payload needs a run card id, got: ${runCardId}`);
  }
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) throw new Error('a flag must state a reason');
  const payload = {
    kind: FLAG_KIND,
    subject_run_card_id: runCardId,
    message: text,
    source,
  };
  if (contactEmail) payload.contact_email = contactEmail;
  if (locale) payload.locale = locale;
  if (pageUrl) payload.page_url = pageUrl;
  return payload;
}

/** File a ticket (question / correction / objection / takedown / flag).
 *
 * A `flag` must carry `subject_run_card_id`; the edge function refuses one
 * without it (and refuses the field on any other kind). The same check runs
 * here so a broken caller gets a named error instead of a 400 round-trip.
 *
 * @param {{message:string, kind?:string, subject_run_card_id?:string, contact_email?:string, locale?:string, page_url?:string, source?:string}} payload
 * @returns {Promise<{ok:boolean, id?:(number|string), emailed?:boolean, message?:string, error?:string}>}
 */
export async function submitTicket(payload) {
  const isFlag = payload?.kind === FLAG_KIND;
  if (isFlag && !isRunCardId(payload.subject_run_card_id)) {
    return {
      ok: false,
      error: 'a flag must name the run card it is about.',
      status: 0,
    };
  }
  if (!isFlag && payload?.subject_run_card_id !== undefined) {
    return {
      ok: false,
      error: `subject_run_card_id is only accepted on a '${FLAG_KIND}' ticket.`,
      status: 0,
    };
  }
  try {
    const resp = await fetch(`${FUNCTIONS}/submit-ticket`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'docent-form', ...payload }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        ok: false,
        error: ticketErrorText(data, resp.status, payload?.kind),
        status: resp.status,
      };
    }
    return data;
  } catch (err) {
    // Never swallow the throw: a flag whose backend is absent fails at the
    // fetch (no CORS headers to allow the response), and "please try again"
    // would be a lie about a lane that is not there.
    const because = err?.message ? ` (${err.message})` : '';
    return {
      ok: false,
      error:
        `could not reach the ticket service${because} — please try again, ` +
        'or email info@champollion.dev.',
      status: 0,
    };
  }
}
