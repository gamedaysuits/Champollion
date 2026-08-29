// lib_test.ts — deno test suite for the ticket-intake validation + helpers.
//
//   deno test lib_test.ts
//
// Dependency-free on purpose (the repo's gates run offline), matching
// ../submit-run/lib_test.ts.

import {
  buildEmailPayload,
  clientIpFrom,
  hashIp,
  isPlausibleEmail,
  isPublicIp,
  MAX_MESSAGE_CHARS,
  rateLimitDecision,
  stripControlChars,
  TICKET_KINDS,
  validateTicket,
} from "./lib.ts";

// ---- tiny assert helpers (no deps) ------------------------------------------

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals(actual: unknown, expected: unknown, msg = ""): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  actual:   ${a}\n  expected: ${e}`);
}

// ---- validateTicket ----------------------------------------------------------

Deno.test("validateTicket: minimal valid ticket (message only)", () => {
  const v = validateTicket({ message: "Please correct the speaker count." });
  assert(v.ok, v.errors.join("; "));
  assertEquals(v.row!.kind, "question", "kind defaults to question");
  assertEquals(v.row!.contact_email, null, "no email by default");
  assertEquals(v.row!.source, "docent-form", "source defaults");
});

Deno.test("validateTicket: rejects missing / empty message", () => {
  assert(!validateTicket({}).ok, "missing message");
  assert(!validateTicket({ message: "" }).ok, "empty message");
  assert(!validateTicket({ message: "   " }).ok, "whitespace-only message");
  assert(!validateTicket({ message: 42 }).ok, "non-string message");
});

Deno.test("validateTicket: message length cap", () => {
  const ok = validateTicket({ message: "x".repeat(MAX_MESSAGE_CHARS) });
  assert(ok.ok, "at cap is ok");
  const tooBig = validateTicket({ message: "x".repeat(MAX_MESSAGE_CHARS + 1) });
  assert(!tooBig.ok, "over cap rejected");
});

Deno.test("validateTicket: kind vocabulary is enforced", () => {
  for (const k of TICKET_KINDS) {
    const v = validateTicket({ message: "hi", kind: k });
    assert(v.ok, `kind ${k} should be valid`);
    assertEquals(v.row!.kind, k);
  }
  assert(!validateTicket({ message: "hi", kind: "urgent" }).ok, "bad kind rejected");
  assert(!validateTicket({ message: "hi", kind: 3 }).ok, "non-string kind rejected");
});

Deno.test("validateTicket: server-owned fields are never accepted from client", () => {
  const v = validateTicket({
    message: "hi",
    id: 999,
    ip_hash: "deadbeef",
    status: "closed",
    notes: "smuggled",
    emailed: true,
    created_at: "2020-01-01",
  } as Record<string, unknown>);
  assert(v.ok, v.errors.join("; "));
  const keys = Object.keys(v.row!).sort();
  assertEquals(
    keys,
    ["contact_email", "kind", "locale", "message", "page_url", "source"],
    "only the six allowlisted fields survive",
  );
});

Deno.test("validateTicket: email validation", () => {
  assert(validateTicket({ message: "hi", contact_email: "a@b.co" }).ok, "valid email");
  assert(
    validateTicket({ message: "hi", contact_email: "" }).ok,
    "empty email is allowed (anonymous)",
  );
  assert(!validateTicket({ message: "hi", contact_email: "not-an-email" }).ok, "junk email");
  assert(
    !validateTicket({ message: "hi", contact_email: "a@b.co\nBcc: x@y.z" }).ok,
    "header-injection email rejected",
  );
});

Deno.test("validateTicket: strips control chars but keeps newlines in message", () => {
  const v = validateTicket({ message: "line1\nline2\ttab\x00\x07bad" });
  assert(v.ok, v.errors.join("; "));
  assertEquals(v.row!.message, "line1\nline2\ttab" + "bad", "kept \\n and \\t, dropped C0");
});

Deno.test("validateTicket: single-line fields collapse newlines", () => {
  const v = validateTicket({ message: "hi", page_url: "https://x.dev/a\nb", locale: "fil" });
  assert(v.ok, v.errors.join("; "));
  assertEquals(v.row!.page_url, "https://x.dev/a b", "newline -> space in url");
  assertEquals(v.row!.locale, "fil");
});

// ---- isPlausibleEmail --------------------------------------------------------

Deno.test("isPlausibleEmail", () => {
  assert(isPlausibleEmail("info@champollion.dev"));
  assert(isPlausibleEmail("a.b+c@sub.example.co.uk"));
  assert(!isPlausibleEmail("nope"));
  assert(!isPlausibleEmail("a@b"), "needs a TLD");
  assert(!isPlausibleEmail("a b@c.dev"), "no spaces");
  assert(!isPlausibleEmail("a@b.dev\r\nEvil: 1"), "no CRLF");
});

// ---- stripControlChars -------------------------------------------------------

Deno.test("stripControlChars", () => {
  assertEquals(stripControlChars("a\x00b\x1fc", true), "abc");
  assertEquals(stripControlChars("keep\nnewline", true), "keep\nnewline");
  assertEquals(stripControlChars("one\ntwo", false), "one two");
  assertEquals(stripControlChars("  pad  ", false), "pad");
});

// ---- rateLimitDecision -------------------------------------------------------

Deno.test("rateLimitDecision", () => {
  assertEquals(rateLimitDecision(0, 0, 3, 100), { allowed: true, reason: "" });
  assertEquals(rateLimitDecision(3, 0, 3, 100), { allowed: false, reason: "ip_hourly" });
  assertEquals(rateLimitDecision(2, 100, 3, 100), { allowed: false, reason: "global_daily" });
});

// ---- IP helpers (lockstep with submit-run) ----------------------------------

Deno.test("isPublicIp: private/loopback/link-local rejected", () => {
  assert(isPublicIp("8.8.8.8"));
  assert(isPublicIp("2606:4700:4700::1111"));
  assert(!isPublicIp("10.0.0.1"));
  assert(!isPublicIp("192.168.1.1"));
  assert(!isPublicIp("127.0.0.1"));
  assert(!isPublicIp("169.254.1.1"));
  assert(!isPublicIp("100.64.0.1"));
  assert(!isPublicIp("::1"));
  assert(!isPublicIp("not-an-ip"));
});

Deno.test("clientIpFrom: takes last public XFF hop, not the spoofable first", () => {
  const h = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 8.8.8.8" });
  assertEquals(clientIpFrom(h), "8.8.8.8");
  const spoof = new Headers({ "x-forwarded-for": "5.5.5.5" });
  assertEquals(clientIpFrom(spoof, "9.9.9.9"), "5.5.5.5", "trusts xff public hop");
  const none = new Headers({});
  assertEquals(clientIpFrom(none, "10.0.0.1"), "unknown", "private conn -> unknown bucket");
});

Deno.test("clientIpFrom: cf-connecting-ip wins — the bucket must not rotate", () => {
  // Regression for the measured Supabase/Cloudflare topology: the real client
  // appears twice at the head of XFF and the LAST hop is an AWS egress address
  // that differs on every request. Keying on that last hop gave each request its
  // own bucket, so the per-IP cap never fired. cf-connecting-ip is stable.
  const req1 = new Headers({
    "cf-connecting-ip": "143.44.145.174",
    "x-forwarded-for": "143.44.145.174,143.44.145.174, 99.82.170.173",
  });
  const req2 = new Headers({
    "cf-connecting-ip": "143.44.145.174",
    "x-forwarded-for": "143.44.145.174,143.44.145.174, 99.83.104.48",
  });
  assertEquals(clientIpFrom(req1), "143.44.145.174");
  assertEquals(
    clientIpFrom(req1),
    clientIpFrom(req2),
    "same visitor must land in the SAME bucket across requests",
  );

  // A private or junk cf-connecting-ip must not be trusted over the XFF walk.
  const bogus = new Headers({
    "cf-connecting-ip": "10.0.0.1",
    "x-forwarded-for": "1.2.3.4, 8.8.8.8",
  });
  assertEquals(clientIpFrom(bogus), "8.8.8.8", "private cf header falls back to H2 walk");
});

Deno.test("hashIp: deterministic, salted, hex, never the raw ip", async () => {
  const a = await hashIp("8.8.8.8", "salt1");
  const b = await hashIp("8.8.8.8", "salt1");
  const c = await hashIp("8.8.8.8", "salt2");
  assertEquals(a, b, "same input -> same hash");
  assert(a !== c, "salt changes the hash");
  assert(/^[0-9a-f]{64}$/.test(a), "sha-256 hex");
  assert(!a.includes("8.8.8.8"), "raw ip never present");
});

// ---- buildEmailPayload -------------------------------------------------------

Deno.test("buildEmailPayload: takedown is flagged urgent", () => {
  const p = buildEmailPayload(
    { kind: "takedown", message: "remove X", locale: "en", page_url: null, contact_email: null, source: "docent-form" },
    7,
    "from@champollion.dev",
    "info@champollion.dev",
  );
  assert(p.subject.includes("URGENT"), "takedown subject urgent");
  assert(p.subject.includes("#7"), "subject carries id");
  assertEquals(p.to, ["info@champollion.dev"]);
  assert(p.reply_to === undefined, "no reply-to when anonymous");
  assert(p.text.includes("remove X"), "message in body");
});

Deno.test("buildEmailPayload: reply-to set when email given; non-takedown not urgent", () => {
  const p = buildEmailPayload(
    { kind: "objection", message: "concern", locale: null, page_url: null, contact_email: "user@example.org", source: "docent-form" },
    12,
    "from@champollion.dev",
    "info@champollion.dev",
  );
  assertEquals(p.reply_to, "user@example.org");
  assert(!p.subject.includes("URGENT"), "objection not urgent");
});
