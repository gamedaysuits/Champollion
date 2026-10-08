// submit-ticket/lib.ts — pure validation + rate-limit + email-payload logic
// for the visitor contact / objection / takedown intake. No I/O here:
// everything in this file is unit-tested by ./lib_test.ts (deno test
// lib_test.ts), dependency-free like ../submit-run/lib.ts.
//
// SSOT NOTE. The field allowlist + caps below mirror the `tickets` table
// (migrations 065 and 074). Anything NOT in the allowlist is silently dropped
// — a caller can never smuggle an unexpected column (e.g. status, notes, id,
// ip_hash, emailed) into the insert. Change them together with 065/074.
//
// THE KIND VOCABULARY IS A THREE-WAY SSOT: this file's TICKET_KINDS, the DB
// CHECK in 074 (`tickets_kind_check`), and the docent client's picker in
// cli/website/src/components/Docent/index.js. It used to be held together by
// this comment alone; arena/tests/test_ticket_kinds_parity.py now reads all
// three and fails when they drift. The Python twin of the list is
// mt_eval_harness.contest_policy.TICKET_KINDS.

// ---- caps ------------------------------------------------------------------

/** Hard cap on the request body, bytes. A ticket is a short message; anything
 * bigger is not a legitimate single ticket. */
export const MAX_BODY_BYTES = 64 * 1024; // 64 KB

/** Message length window — mirrors the 065 CHECK (1..8000). */
export const MAX_MESSAGE_CHARS = 8_000;
export const MAX_EMAIL_CHARS = 320; // RFC 5321 max address length
export const MAX_PAGE_URL_CHARS = 2048;
export const MAX_LOCALE_CHARS = 12;
export const MAX_SOURCE_CHARS = 40;

/** Default rate limits (env-overridable in index.ts). Tighter than the
 * run-card lane: a ticket is a human writing a sentence, not a batch job. */
export const DEFAULT_IP_HOURLY_CAP = 3;
export const DEFAULT_GLOBAL_DAILY_CAP = 100;

/** The classification vocabulary — must match the 074 kind CHECK (065's five
 * kinds plus `flag`). Order matches the SQL literal list so the parity test can
 * compare them element by element. */
export const TICKET_KINDS: ReadonlySet<string> = new Set([
  "takedown",
  "objection",
  "correction",
  "question",
  "flag",
  "other",
]);

/** The kind that names a run card: a reader who believes a published result is
 * wrong (contaminated corpus, gamed metric, misattributed method) files one
 * against that card's id. It is an inbox item, never a score — no count of
 * flags is ever rendered publicly, and an upheld flag shows up only as the
 * card's `trust` becoming `disqualified`, with the cause added to the public
 * rules page by dated edit FIRST. */
export const FLAG_KIND = "flag";

/** Shape of `tickets.subject_run_card_id` — the SAME rule as the 074 CHECK
 * `subject_run_card_id ~ '^[0-9a-f-]{36}$'` (run card ids are uuid5, lower-case
 * hex with dashes). Kept as a shape test, not a uuid-version test, so the two
 * halves cannot disagree. */
export const RUN_CARD_ID_PATTERN = /^[0-9a-f-]{36}$/;

/** Is this string the shape of a run card id? */
export function isRunCardId(v: unknown): v is string {
  return typeof v === "string" && RUN_CARD_ID_PATTERN.test(v);
}

// ---- validation -------------------------------------------------------------

export interface TicketRow {
  kind: string;
  message: string;
  locale: string | null;
  page_url: string | null;
  contact_email: string | null;
  source: string;
  /** The run card a `flag` is about (074). NULL for every other kind. */
  subject_run_card_id: string | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** Sanitized ticket row WITHOUT ip_hash (bound by the handler). */
  row: TicketRow | null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Strip control chars that would let a value poison an email header/subject.
 * Deliberately conservative:
 *   - allowNewlines=true (the message body): remove C0 control chars and lone
 *     CR, but KEEP newline (\x0A) and tab (\x09) so prose survives.
 *   - allowNewlines=false (single-line fields — locale/url/source/subject):
 *     replace every control char (incl. newlines) with a space, collapse runs,
 *     and trim, so nothing single-line can carry a line break. */
export function stripControlChars(s: string, allowNewlines = false): string {
  if (allowNewlines) {
    // remove \x00-\x08, \x0B-\x1F, \x7F  (keeps \t=\x09 and \n=\x0A)
    // deno-lint-ignore no-control-regex
    return s.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "").trim();
  }
  // deno-lint-ignore no-control-regex
  return s.replace(/[\x00-\x1F\x7F]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Conservative email-shape check. Not RFC-perfect — just enough to reject
 * junk and anything with whitespace / control chars (header-injection guard).
 * An empty / missing email is handled by the caller (anonymous filing is OK). */
export function isPlausibleEmail(email: string): boolean {
  if (email.length === 0 || email.length > MAX_EMAIL_CHARS) return false;
  // no whitespace or control chars anywhere in an address
  // deno-lint-ignore no-control-regex
  if (/[\s\x00-\x1F\x7F]/.test(email)) return false;
  // single @, non-empty local part, dotted domain with a 2+ char alpha TLD
  return /^[^@\s]{1,64}@[^@\s.]+(\.[^@\s.]+)+$/.test(email) &&
    /\.[A-Za-z]{2,}$/.test(email);
}

/** Validate + sanitize one ticket submission.
 *
 * Shape: { message: string (required),
 *          kind?: 'takedown'|'objection'|'correction'|'question'|'flag'|'other',
 *          subject_run_card_id?: string  (REQUIRED iff kind === 'flag'),
 *          locale?: string, page_url?: string, contact_email?: string,
 *          source?: string }
 *
 * Everything server-owned (id, ip_hash, status, notes, emailed, created_at) is
 * NOT accepted from the client and is set by the handler / DB defaults.
 *
 * A `flag` carries the same required, non-empty, ≤8000-char message as every
 * other kind — a flag with no stated reason is not a flag, it is a downvote.
 * `subject_run_card_id` is rejected on any other kind rather than dropped:
 * silently discarding the one field that says WHICH card a complaint is about
 * would be the worst kind of quiet failure.
 *
 * NOTE — the subject card is NOT looked up. This function has no read of
 * `run_cards` (it holds the service role and adding one would put a public,
 * unauthenticated door in front of a table read for no triage benefit), so a
 * flag against an id that does not exist, or no longer exists, is ACCEPTED and
 * recorded. Triage sees it and closes it. That is deliberate: a flag must be
 * fileable against a card that is deleted a second later, and the 074 column
 * carries no foreign key for exactly the same reason.
 */
export function validateTicket(body: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(body)) {
    return { ok: false, errors: ["body must be a JSON object"], row: null };
  }

  // message (required)
  const rawMessage = body.message;
  let message = "";
  if (typeof rawMessage !== "string") {
    errors.push("message is required and must be a string");
  } else {
    message = stripControlChars(rawMessage, true);
    if (message.length === 0) errors.push("message must not be empty");
    if (message.length > MAX_MESSAGE_CHARS) {
      errors.push(`message exceeds ${MAX_MESSAGE_CHARS} chars`);
    }
  }

  // kind (optional, defaults 'question')
  let kind = "question";
  if (body.kind !== undefined && body.kind !== null && body.kind !== "") {
    if (typeof body.kind !== "string" || !TICKET_KINDS.has(body.kind)) {
      errors.push(`kind must be one of: ${Array.from(TICKET_KINDS).join(", ")}`);
    } else {
      kind = body.kind;
    }
  }

  // subject_run_card_id — required on a flag, refused on anything else.
  let subject_run_card_id: string | null = null;
  const rawSubject = body.subject_run_card_id;
  const subjectGiven = rawSubject !== undefined && rawSubject !== null &&
    rawSubject !== "";
  if (kind === FLAG_KIND) {
    if (!subjectGiven) {
      errors.push(
        "subject_run_card_id is required for a flag — a flag names the run " +
          "card it is about",
      );
    } else if (!isRunCardId(rawSubject)) {
      errors.push(
        "subject_run_card_id must be a run card id (36 chars of [0-9a-f-])",
      );
    } else {
      subject_run_card_id = rawSubject as string;
    }
  } else if (subjectGiven) {
    errors.push(
      `subject_run_card_id is only accepted on a '${FLAG_KIND}' ticket`,
    );
  }

  // contact_email (optional)
  let contact_email: string | null = null;
  if (
    body.contact_email !== undefined && body.contact_email !== null &&
    body.contact_email !== ""
  ) {
    if (typeof body.contact_email !== "string") {
      errors.push("contact_email must be a string when present");
    } else {
      const e = body.contact_email.trim();
      if (!isPlausibleEmail(e)) {
        errors.push("contact_email is not a valid email address");
      } else {
        contact_email = e;
      }
    }
  }

  // locale / page_url / source (optional, capped, single-line)
  const locale = optionalCapped(body.locale, MAX_LOCALE_CHARS, "locale", errors);
  const page_url = optionalCapped(
    body.page_url,
    MAX_PAGE_URL_CHARS,
    "page_url",
    errors,
  );
  let source = "docent-form";
  if (body.source !== undefined && body.source !== null && body.source !== "") {
    const s = optionalCapped(body.source, MAX_SOURCE_CHARS, "source", errors);
    if (s) source = s;
  }

  if (errors.length > 0) return { ok: false, errors, row: null };

  return {
    ok: true,
    errors: [],
    row: {
      kind,
      message,
      locale,
      page_url,
      contact_email,
      source,
      subject_run_card_id,
    },
  };
}

/** The exact JSON body the handler POSTs to `tickets`, given a validated row
 * and the bound ip_hash.
 *
 * `subject_run_card_id` is OMITTED (not sent as null) when there is none, so
 * the five legacy kinds keep working against a database where migration 074
 * has not been applied yet — a flag, which needs the column, then fails LOUDLY
 * with PostgREST's own "column does not exist" instead of taking every other
 * ticket down with it. */
export function insertPayload(
  row: TicketRow,
  ipHash: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...row, ip_hash: ipHash };
  if (row.subject_run_card_id === null) delete payload.subject_run_card_id;
  return payload;
}

/** What the visitor is told after the row is saved. A flag gets the honest
 * shape of the outcome: private ticket in, no public counter, and the only
 * visible result of an upheld flag is the card's trust turning
 * `disqualified` after the cause is written into the public rules. */
export function ackMessage(row: TicketRow): string {
  if (row.kind === FLAG_KIND) {
    return "Thank you — your flag has been recorded against run card " +
      `${row.subject_run_card_id}. Flags are private tickets: no count of ` +
      "them is ever shown on the board. If it is upheld, the only public " +
      "change is that card's trust becoming 'disqualified', and the cause " +
      "is added to the submission rules by a dated edit first." +
      (row.contact_email ? " We'll reply if a response is needed." : "");
  }
  return "Thank you — your message has been recorded" +
    (row.contact_email ? " and we'll reply if a response is needed." : ".");
}

function optionalCapped(
  v: unknown,
  cap: number,
  field: string,
  errors: string[],
): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") {
    errors.push(`${field} must be a string when present`);
    return null;
  }
  const clean = stripControlChars(v, false);
  if (clean.length > cap) {
    errors.push(`${field} exceeds ${cap} chars`);
    return null;
  }
  return clean.length > 0 ? clean : null;
}

// ---- rate limiting -----------------------------------------------------------

export interface RateDecision {
  allowed: boolean;
  reason: "" | "ip_hourly" | "global_daily";
}

/** Pure decision over the two window counts (queried by the handler). */
export function rateLimitDecision(
  ipHourCount: number,
  globalDayCount: number,
  ipHourlyCap: number,
  globalDailyCap: number,
): RateDecision {
  if (ipHourCount >= ipHourlyCap) return { allowed: false, reason: "ip_hourly" };
  if (globalDayCount >= globalDailyCap) {
    return { allowed: false, reason: "global_daily" };
  }
  return { allowed: true, reason: "" };
}

export function rateLimitMessage(reason: "ip_hourly" | "global_daily"): string {
  return reason === "ip_hourly"
    ? "This connection has sent several messages recently. Please wait a " +
      "little while before sending another — or email info@champollion.dev " +
      "directly for anything urgent."
    : "The contact form has reached its daily volume cap. For anything " +
      "urgent, email info@champollion.dev directly.";
}

/** Salted SHA-256 of the client IP — the only form ever stored. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Is this a syntactically valid PUBLIC IP (v4 or v6)? Private, loopback,
 * link-local, CGNAT, and unspecified addresses return false. Mirrors
 * ../submit-run/lib.ts::isPublicIp (kept in lockstep by test). */
export function isPublicIp(ip: string): boolean {
  const s = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (!s) return false;
  const v4 = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const o = v4.slice(1).map(Number);
    if (o.some((x) => x > 255)) return false;
    if (o[0] === 0 || o[0] === 10 || o[0] === 127) return false;
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return false;
    if (o[0] === 169 && o[1] === 254) return false;
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return false;
    if (o[0] === 192 && o[1] === 168) return false;
    return true;
  }
  if (s.includes(":") && /^[0-9a-f:.]{2,45}$/.test(s)) {
    if (s === "::" || s === "::1") return false;
    if (s.startsWith("fc") || s.startsWith("fd")) return false;
    if (/^fe[89ab]/.test(s)) return false;
    const mapped = s.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) return isPublicIp(mapped[1]);
    return true;
  }
  return false;
}

/** Client IP for the rate-limit bucket — never the client-spoofable leftmost
 * x-forwarded-for hop (submit-run H2).
 *
 * PLATFORM NOTE (measured on Supabase Edge Functions, 2026-07-26). Requests
 * reach the function through Cloudflare, and x-forwarded-for arrives as:
 *
 *     "143.44.145.174,143.44.145.174, 99.83.104.48"
 *      ^ real client   ^ real client   ^ AWS egress — DIFFERENT EVERY REQUEST
 *
 * so the H2 rule "take the last public hop" — written for a topology where that
 * hop was the stable edge — hands every single request its own bucket, and the
 * per-IP cap SILENTLY NEVER FIRES. (`info.remoteAddr` is 0.0.0.0 here, so it
 * cannot rescue it either.) Verified by filing four tickets in a row: three
 * distinct ip_hash values, no 429.
 *
 * cf-connecting-ip is written by Cloudflare itself and OVERWRITES whatever the
 * caller sent, so it is both stable across requests and not client-spoofable —
 * it is the correct bucket key on this platform. The H2 walk is kept as the
 * fallback for any deployment not behind Cloudflare, which is also what the
 * lockstep tests exercise. */
export function clientIpFrom(headers: Headers, connectionIp = ""): string {
  const cf = (headers.get("cf-connecting-ip") ?? "").trim();
  if (isPublicIp(cf)) return cf;

  const xff = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (let i = xff.length - 1; i >= 0; i--) {
    if (isPublicIp(xff[i])) return xff[i];
  }
  const conn = connectionIp.trim();
  if (isPublicIp(conn)) return conn;
  return "unknown";
}

// ---- email payload -----------------------------------------------------------

export interface EmailPayload {
  from: string;
  to: string[];
  reply_to?: string;
  subject: string;
  text: string;
}

/** Build the Resend-shaped notification email for a ticket. Pure (no fetch) so
 * it is unit-tested. `to` and `from` come from env in the handler. Takedown
 * tickets are flagged URGENT in the subject. The reply-to is set to the
 * visitor's contact_email when they left one, so a reply goes to them.
 *
 * A `flag` carries the run card id it names in the subject and the body, so
 * triage can open the card without reading the whole message. It is otherwise
 * an ordinary ticket: it goes to the SAME private inbox as every other kind
 * and to nowhere else. Nothing here is published — in particular the flagger's
 * contact_email travels only as the private notification's reply-to, and never
 * onto the board, the card, or any public count. */
export function buildEmailPayload(
  row: TicketRow,
  ticketId: number | string,
  from: string,
  to: string,
): EmailPayload {
  const urgent = row.kind === "takedown";
  const isFlag = row.kind === FLAG_KIND;
  // Subject is single-line: strip any residual control chars defensively.
  const subject = stripControlChars(
    `${urgent ? "[URGENT - TAKEDOWN] " : ""}[Champollion] ${row.kind} ticket #${ticketId}` +
      (isFlag ? ` - run card ${row.subject_run_card_id}` : ""),
    false,
  );
  const rule = "-".repeat(56);
  const lines = [
    `A new ${row.kind} ticket was filed on champollion.dev.`,
    "",
    `Ticket ID:   ${ticketId}`,
    `Kind:        ${row.kind}${urgent ? "   <- act on this first" : ""}`,
    ...(isFlag
      ? [
        `Run card:    ${row.subject_run_card_id}`,
        "             (not verified to exist - this function never reads",
        "              run_cards; triage checks the id)",
      ]
      : []),
    `Locale:      ${row.locale ?? "(not given)"}`,
    `Page:        ${row.page_url ?? "(not given)"}`,
    `Reply-to:    ${row.contact_email ?? "(anonymous - no reply address)"}`,
    `Source:      ${row.source}`,
    "",
    "Message:",
    rule,
    row.message,
    rule,
    "",
    ...(isFlag
      ? [
        "Triage: verify, decide, then add the cause to the public submission",
        "rules by a DATED edit BEFORE setting run_cards.trust='disqualified'.",
        "No count of flags is ever public.",
        "",
      ]
      : []),
    "This is a notification. The ticket is saved durably in the `tickets`",
    "table regardless of whether this email was delivered.",
  ];
  const payload: EmailPayload = {
    from,
    to: [to],
    subject,
    text: lines.join("\n"),
  };
  if (row.contact_email) payload.reply_to = row.contact_email;
  return payload;
}
