// submit-ticket — visitor contact / objection / takedown intake
// (founder direction 2026-07-20). The site docent's ticket form (and any
// client) POSTs one message here; it is validated (./lib.ts), rate-limited per
// IP against the `tickets` table (migration 065), inserted with the SERVICE
// ROLE, and a notification is emailed to info@champollion.dev via Resend.
//
// Deployed with verify_jwt DISABLED (`supabase functions deploy submit-ticket
// --no-verify-jwt`) so an unauthenticated visitor can file a ticket.
//
// HONESTY RAIL: the DB row is the record of record. If the email send fails
// (or Resend isn't configured yet), the ticket is STILL saved and the caller
// is told it was recorded — email is a notification, never the source of
// truth. No silent failure: email errors are logged and reflected in the
// `emailed` column and the function logs.
//
// Responses:
//   200 {ok:true, id, emailed}          — ticket recorded (emailed may be false)
//   400 {ok:false, error}               — validation
//   405 / 413 / 429 / 503 / 500 as usual
//
// Deploy + config: see ./README.md. Tests: deno test lib_test.ts

// deno-lint-ignore-file no-explicit-any

import {
  buildEmailPayload,
  clientIpFrom,
  DEFAULT_GLOBAL_DAILY_CAP,
  DEFAULT_IP_HOURLY_CAP,
  hashIp,
  MAX_BODY_BYTES,
  rateLimitDecision,
  rateLimitMessage,
  validateTicket,
} from "./lib.ts";

// ---- env -------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IP_HOURLY_CAP = Number(
  Deno.env.get("TICKET_IP_HOURLY_CAP") ?? String(DEFAULT_IP_HOURLY_CAP),
);
const GLOBAL_DAILY_CAP = Number(
  Deno.env.get("TICKET_GLOBAL_DAILY_CAP") ?? String(DEFAULT_GLOBAL_DAILY_CAP),
);
const IP_SALT = Deno.env.get("TICKET_IP_SALT") ?? "champollion-ticket-intake-v1";

// Email (Resend). All three are founder-set at deploy time. If RESEND_API_KEY
// is absent the ticket is still saved (emailed=false) — the lane works on the
// dev branch before email is wired.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_TO = Deno.env.get("TICKET_EMAIL_TO") ?? "info@champollion.dev";
const EMAIL_FROM = Deno.env.get("TICKET_EMAIL_FROM") ??
  "Champollion Tickets <tickets@champollion.dev>";

// CORS: locked to the site origins (the ticket form runs on champollion.dev).
// Override with a comma-separated TICKET_ALLOWED_ORIGINS for staging/preview.
const ALLOWED_ORIGINS = (Deno.env.get("TICKET_ALLOWED_ORIGINS") ??
  "https://champollion.dev,https://www.champollion.dev")
  .split(",").map((s) => s.trim()).filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  // Echo the origin only when it's on the allowlist; otherwise fall back to
  // the canonical origin (a disallowed cross-origin browser call is blocked by
  // the browser, and non-browser callers ignore CORS entirely).
  const allow = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// ---- PostgREST helpers (service role) ---------------------------------------

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Exact count of rows matching a PostgREST filter (HEAD + count=exact). */
async function restCount(pathAndQuery: string): Promise<number> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method: "HEAD",
    headers: restHeaders({ Prefer: "count=exact" }),
  });
  if (!resp.ok) throw new Error(`count query failed (${resp.status})`);
  const range = resp.headers.get("content-range") ?? "";
  const n = Number(range.split("/")[1]);
  return Number.isFinite(n) ? n : 0;
}

// ---- email (best-effort) -----------------------------------------------------

/** Send the notification via Resend. Returns true on delivery, false on any
 * failure or when Resend is not configured. NEVER throws to the caller. */
async function sendEmail(payload: unknown): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY unset — ticket saved, email skipped");
    return false;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      console.error("Resend send failed:", resp.status, (await resp.text()).slice(0, 300));
      return false;
    }
    await resp.body?.cancel();
    return true;
  } catch (err) {
    console.error("Resend send errored:", err);
    return false;
  }
}

// ---- handler -----------------------------------------------------------------

async function handle(req: Request, connectionIp = ""): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "POST only" }, origin);
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: `payload exceeds ${MAX_BODY_BYTES} bytes` }, origin);
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: `payload exceeds ${MAX_BODY_BYTES} bytes` }, origin);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: "body is not valid JSON" }, origin);
  }

  const v = validateTicket(body);
  if (!v.ok || !v.row) {
    return json(400, { ok: false, error: `validation: ${v.errors.join("; ")}` }, origin);
  }
  const row = v.row;

  // ---- rate limit (count on the tickets table itself) ------------------------
  const ip = clientIpFrom(req.headers, connectionIp);
  const ipHash = await hashIp(ip, IP_SALT);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  let decision;
  try {
    const [ipCount, globalCount] = await Promise.all([
      restCount(`tickets?ip_hash=eq.${ipHash}&created_at=gte.${hourAgo}&select=id`),
      restCount(`tickets?created_at=gte.${dayAgo}&select=id`),
    ]);
    decision = rateLimitDecision(ipCount, globalCount, IP_HOURLY_CAP, GLOBAL_DAILY_CAP);
  } catch (err) {
    // Fail closed but honestly — never open the floodgates on a ledger error.
    console.error("tickets rate-count failed:", err);
    return json(503, {
      ok: false,
      error: "the contact system is briefly unavailable — please try again " +
        "shortly, or email info@champollion.dev directly.",
    }, origin);
  }
  if (!decision.allowed) {
    return json(429, {
      ok: false,
      error: rateLimitMessage(decision.reason as "ip_hourly" | "global_daily"),
      retry_after_seconds: decision.reason === "ip_hourly" ? 3600 : 86400,
    }, origin);
  }

  // ---- insert the ticket (service role; the durable record of record) --------
  const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/tickets`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({ ...row, ip_hash: ipHash }),
  });
  if (!insertResp.ok) {
    const detail = (await insertResp.text()).slice(0, 400);
    console.error(`tickets insert rejected (${insertResp.status}):`, detail);
    return json(400, {
      ok: false,
      error: `the database rejected this ticket: ${detail}`,
    }, origin);
  }
  const inserted = await insertResp.json();
  const ticketId = Array.isArray(inserted) && inserted[0]?.id != null
    ? inserted[0].id
    : "(unknown)";

  // ---- notify (best-effort; the ticket is already saved) ---------------------
  const emailed = await sendEmail(
    buildEmailPayload(row, ticketId, EMAIL_FROM, EMAIL_TO),
  );
  if (emailed && ticketId !== "(unknown)") {
    // Mark the row as notified. Failure here is cosmetic — log, don't fail.
    try {
      const patch = await fetch(
        `${SUPABASE_URL}/rest/v1/tickets?id=eq.${encodeURIComponent(String(ticketId))}`,
        {
          method: "PATCH",
          headers: restHeaders(),
          body: JSON.stringify({ emailed: true }),
        },
      );
      await patch.body?.cancel();
    } catch (err) {
      console.error("tickets emailed-flag update failed:", err);
    }
  }

  return json(200, {
    ok: true,
    id: ticketId,
    emailed,
    message: "Thank you — your message has been recorded" +
      (row.contact_email ? " and we'll reply if a response is needed." : "."),
  }, origin);
}

Deno.serve(
  async (req: Request, info?: { remoteAddr?: { hostname?: string } }) => {
    try {
      return await handle(req, info?.remoteAddr?.hostname ?? "");
    } catch (err) {
      console.error("submit-ticket failed:", err);
      return json(500, { ok: false, error: String(err) }, req.headers.get("origin"));
    }
  },
);
