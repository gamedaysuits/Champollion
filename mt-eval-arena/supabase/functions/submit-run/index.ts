// submit-run — anonymous run-card intake (founder directive 2026-07-13:
// OAuth is optional, not required, for contributing to the queue).
//
// Deployed with verify_jwt DISABLED (`supabase functions deploy submit-run
// --no-verify-jwt`) so an unauthenticated contributor can POST one run-card
// payload. The function validates strictly (./lib.ts), rate-limits per IP
// (anon_intake_log, migration 050), and inserts with the SERVICE ROLE as:
//
//     submitter='anonymous', owner_uid=NULL, trust='unverified'
//
// The service role bypasses RLS but NOT triggers — the quarantine guard
// (022), score integrity (023), sha parity (026), and the per-entry corpus
// content guard (033) all still fire, and their rejections are passed
// through to the caller verbatim. Honesty rails, not conveniences.
//
// Responses:
//   200 {ok:true, id, entries_published, entries_withheld_reason?}
//   200 {ok:true, already_published:true, id}      — idempotent duplicate
//   400 {ok:false, error}                          — validation / trigger reject
//   405 / 413 / 429 / 500 as usual; 429 includes the sign-in hint.
//
// Deploy + config: see ./README.md. Tests: deno test lib_test.ts

// deno-lint-ignore-file no-explicit-any

import {
  bindEntries,
  clientIpFrom,
  DEFAULT_GLOBAL_DAILY_CAP,
  DEFAULT_IP_HOURLY_CAP,
  hashIp,
  MAX_BODY_BYTES,
  rateLimitDecision,
  rateLimitMessage,
  validateSubmission,
} from "./lib.ts";

// ---- env -------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IP_HOURLY_CAP = Number(
  Deno.env.get("ANON_IP_HOURLY_CAP") ?? String(DEFAULT_IP_HOURLY_CAP),
);
const GLOBAL_DAILY_CAP = Number(
  Deno.env.get("ANON_GLOBAL_DAILY_CAP") ?? String(DEFAULT_GLOBAL_DAILY_CAP),
);
// Salt for the stored IP hash. A fixed default keeps the window stable across
// cold starts; set ANON_IP_SALT to rotate it.
const IP_SALT = Deno.env.get("ANON_IP_SALT") ?? "champollion-anon-intake-v1";

const ENTRY_BATCH_SIZE = 200;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
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
  if (!resp.ok) {
    throw new Error(`count query failed (${resp.status})`);
  }
  // content-range: 0-24/57  (or */0)
  const range = resp.headers.get("content-range") ?? "";
  const total = range.split("/")[1];
  const n = Number(total);
  return Number.isFinite(n) ? n : 0;
}

async function fetchExistingCard(id: string): Promise<any | null> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/run_cards?id=eq.${encodeURIComponent(id)}` +
      `&select=id,submitter,submitted_at,trust`,
    { headers: restHeaders() },
  );
  if (!resp.ok) return null;
  const rows = await resp.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

// ---- handler -----------------------------------------------------------------

async function handle(req: Request, connectionIp = ""): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "POST only" });
  }

  // Size guard — refuse before buffering an oversized body when the client
  // declares its length, and re-check after reading (chunked bodies).
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return json(413, {
      ok: false,
      error: `payload exceeds ${MAX_BODY_BYTES} bytes`,
    });
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, {
      ok: false,
      error: `payload exceeds ${MAX_BODY_BYTES} bytes`,
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: "body is not valid JSON" });
  }

  const v = validateSubmission(body);
  if (!v.ok || !v.row) {
    return json(400, { ok: false, error: `validation: ${v.errors.join("; ")}` });
  }
  const row = v.row;
  const cardId = String(row.id);

  // ---- rate limit ------------------------------------------------------------
  // H2 (audit 2026-07-18): last PUBLIC x-forwarded-for hop / connection peer —
  // never the client-spoofable leftmost hop. See lib.ts clientIpFrom.
  const ip = clientIpFrom(req.headers, connectionIp);
  const ipHash = await hashIp(ip, IP_SALT);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  let decision;
  try {
    const [ipCount, globalCount] = await Promise.all([
      restCount(
        `anon_intake_log?ip_hash=eq.${ipHash}&submitted_at=gte.${hourAgo}&select=id`,
      ),
      restCount(`anon_intake_log?submitted_at=gte.${dayAgo}&select=id`),
    ]);
    decision = rateLimitDecision(
      ipCount,
      globalCount,
      IP_HOURLY_CAP,
      GLOBAL_DAILY_CAP,
    );
  } catch (err) {
    // The ledger being unreachable must not silently open the floodgates —
    // fail closed but honestly (the report survives client-side).
    console.error("anon_intake_log count failed:", err);
    return json(503, {
      ok: false,
      error:
        "rate-limit ledger unavailable — try again shortly; your report is " +
        "saved locally and can be re-published with `mt-eval publish`.",
    });
  }
  if (!decision.allowed) {
    return json(429, {
      ok: false,
      error: rateLimitMessage(decision.reason as "ip_hourly" | "global_daily"),
      retry_after_seconds: decision.reason === "ip_hourly" ? 3600 : 86400,
    });
  }

  // ---- duplicate pre-flight (idempotent by fingerprint UUID) -----------------
  const existing = await fetchExistingCard(cardId);
  if (existing) {
    return json(200, { ok: true, already_published: true, id: cardId });
  }

  // ---- insert the run card (service role; triggers still fire) ---------------
  const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/run_cards`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(row),
  });
  if (!insertResp.ok) {
    const detail = (await insertResp.text()).slice(0, 500);
    // A concurrent duplicate (unique violation) is a success — the card IS
    // on the board.
    if (insertResp.status === 409 || detail.includes("duplicate key")) {
      return json(200, { ok: true, already_published: true, id: cardId });
    }
    // Trigger rejections (quarantine / score integrity / sha parity) arrive
    // as PostgREST errors — pass the reason through verbatim. These are the
    // honesty rails working, not a malfunction.
    console.error(`run_cards insert rejected (${insertResp.status}):`, detail);
    return json(400, {
      ok: false,
      error: `the database rejected this run card: ${detail}`,
    });
  }
  await insertResp.body?.cancel();

  // ---- log the successful intake (the rate-limit ledger) ---------------------
  try {
    const logResp = await fetch(`${SUPABASE_URL}/rest/v1/anon_intake_log`, {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({ ip_hash: ipHash, run_card_id: cardId }),
    });
    if (!logResp.ok) {
      console.error("anon_intake_log insert failed:", await logResp.text());
    } else {
      await logResp.body?.cancel();
    }
  } catch (err) {
    // The card is already published — never fail the submission over the
    // ledger write; just surface it in the function logs.
    console.error("anon_intake_log insert errored:", err);
  }

  // ---- entries (optional; the 033 content guard is the un-bypassable gate) ---
  let entriesPublished = 0;
  let withheldReason: string | undefined;
  if (v.entries.length > 0) {
    const rows = bindEntries(v.entries, cardId);
    for (let i = 0; i < rows.length; i += ENTRY_BATCH_SIZE) {
      const batch = rows.slice(i, i + ENTRY_BATCH_SIZE);
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/run_card_entries`, {
        method: "POST",
        headers: restHeaders({ Prefer: "resolution=ignore-duplicates" }),
        body: JSON.stringify(batch),
      });
      if (resp.ok) {
        await resp.body?.cancel();
        entriesPublished += batch.length;
      } else {
        // The content guard rejects per-ROW but fails the whole batch
        // statement; its reason is dataset-level, so stop and report it.
        // The aggregate run card above is already published (scores-only).
        withheldReason = (await resp.text()).slice(0, 400);
        console.error("entry batch rejected:", withheldReason);
        break;
      }
    }
  }

  return json(200, {
    ok: true,
    id: cardId,
    submitter: "anonymous",
    entries_published: entriesPublished,
    ...(withheldReason
      ? {
        entries_withheld_reason: withheldReason,
        note: "run card published scores-only; per-entry corpus content " +
          "was withheld by the database content guard",
      }
      : {}),
  });
}

Deno.serve(
  async (
    req: Request,
    info?: { remoteAddr?: { hostname?: string } },
  ) => {
    try {
      return await handle(req, info?.remoteAddr?.hostname ?? "");
    } catch (err) {
      console.error("submit-run failed:", err);
      return json(500, { ok: false, error: String(err) });
    }
  },
);
