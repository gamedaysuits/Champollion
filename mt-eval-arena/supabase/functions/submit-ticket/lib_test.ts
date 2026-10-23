// lib_test.ts — deno test suite for the ticket-intake validation + helpers.
//
//   deno test lib_test.ts
//
// Dependency-free on purpose (the repo's gates run offline), matching
// ../submit-run/lib_test.ts.

import {
  ackMessage,
  buildEmailPayload,
  clientIpFrom,
  FLAG_KIND,
  hashIp,
  insertPayload,
  isPlausibleEmail,
  isPublicIp,
  isRunCardId,
  MAX_MESSAGE_CHARS,
  rateLimitDecision,
  stripControlChars,
  TICKET_KINDS,
  validateTicket,
} from "./lib.ts";

/** A well-shaped run card id (uuid5, the shape the 074 CHECK enforces). */
const CARD_ID = "2f1b7c84-9a0e-5d3f-8b61-0c4e7a9d1234";

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
    // 'flag' is the one kind with a second required field (074): it names the
    // run card it is about. Everything else takes a bare message.
    const extra = k === FLAG_KIND ? { subject_run_card_id: CARD_ID } : {};
    const v = validateTicket({ message: "hi", kind: k, ...extra });
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
    [
      "contact_email",
      "kind",
      "locale",
      "message",
      "page_url",
      "source",
      "subject_run_card_id",
    ],
    "only the seven allowlisted fields survive",
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
    { kind: "takedown", message: "remove X", locale: "en", page_url: null, contact_email: null, source: "docent-form", subject_run_card_id: null },
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
    { kind: "objection", message: "concern", locale: null, page_url: null, contact_email: "user@example.org", source: "docent-form", subject_run_card_id: null },
    12,
    "from@champollion.dev",
    "info@champollion.dev",
  );
  assertEquals(p.reply_to, "user@example.org");
  assert(!p.subject.includes("URGENT"), "objection not urgent");
});

// ---- community flagging (kind='flag', migration 074) -------------------------
//
// Practice 13 of the shared-task adoption programme: a reader who believes a
// published run card is wrong files a flag against that card's id. The flag is
// a private ticket. No count of flags is ever public; an upheld flag shows up
// only as the card's trust becoming 'disqualified', with the cause added to the
// public rules page by a dated edit FIRST.

Deno.test("validateTicket: 'flag' is in the vocabulary", () => {
  assert(TICKET_KINDS.has(FLAG_KIND), "flag must be an accepted kind");
  assertEquals(
    Array.from(TICKET_KINDS),
    ["takedown", "objection", "correction", "question", "flag", "other"],
    "order + membership must match the 074 kind CHECK",
  );
});

Deno.test("isRunCardId: the 074 shape rule, nothing looser", () => {
  assert(isRunCardId(CARD_ID));
  assert(!isRunCardId(CARD_ID.toUpperCase()), "upper case is not the stored shape");
  assert(!isRunCardId(CARD_ID.slice(0, 35)), "too short");
  assert(!isRunCardId(CARD_ID + "0"), "too long");
  assert(!isRunCardId("g".repeat(36)), "non-hex");
  assert(!isRunCardId(""), "empty");
  assert(!isRunCardId(null), "non-string");
});

Deno.test("validateTicket: a flag REQUIRES a subject run card id", () => {
  const missing = validateTicket({
    kind: "flag",
    message: "This card's corpus is contaminated — the dev split leaked.",
  });
  assert(!missing.ok, "a flag with no subject must be refused");
  assert(
    missing.errors.join(" ").includes("subject_run_card_id is required"),
    `error must name the missing field: ${missing.errors.join("; ")}`,
  );

  const badShape = validateTicket({
    kind: "flag",
    message: "wrong method attribution",
    subject_run_card_id: "not-a-card-id",
  });
  assert(!badShape.ok, "a malformed subject must be refused");
  assert(
    badShape.errors.join(" ").includes("36 chars"),
    "error must state the shape rule",
  );
});

Deno.test("validateTicket: a well-formed flag is accepted and carries the card", () => {
  const v = validateTicket({
    kind: "flag",
    message: "The metric label says chrF++ but the score is corpus BLEU.",
    subject_run_card_id: CARD_ID,
    page_url: "https://champollion.dev/leaderboard",
    locale: "en",
  });
  assert(v.ok, v.errors.join("; "));
  assertEquals(v.row!.kind, "flag");
  assertEquals(v.row!.subject_run_card_id, CARD_ID);
});

Deno.test("validateTicket: a flag still needs a stated reason", () => {
  // Same message rule as every other kind (required, non-empty, <= 8000):
  // a flag with no reason is a downvote, and the board has no downvotes.
  assert(
    !validateTicket({ kind: "flag", subject_run_card_id: CARD_ID }).ok,
    "no message",
  );
  assert(
    !validateTicket({ kind: "flag", message: "   ", subject_run_card_id: CARD_ID }).ok,
    "whitespace-only message",
  );
  assert(
    !validateTicket({
      kind: "flag",
      message: "x".repeat(MAX_MESSAGE_CHARS + 1),
      subject_run_card_id: CARD_ID,
    }).ok,
    "over the message cap",
  );
});

Deno.test("validateTicket: subject_run_card_id is refused on a non-flag kind", () => {
  // Refused, not silently dropped: quietly discarding the field that says
  // WHICH card a complaint is about is exactly the failure this lane exists
  // to prevent.
  const v = validateTicket({
    kind: "correction",
    message: "typo on the card",
    subject_run_card_id: CARD_ID,
  });
  assert(!v.ok, "a non-flag kind must not carry a subject card");
  assert(v.errors.join(" ").includes("only accepted on a 'flag'"));

  const dflt = validateTicket({ message: "hi", subject_run_card_id: CARD_ID });
  assert(!dflt.ok, "the default kind (question) is not a flag either");
});

Deno.test("validateTicket: non-flag kinds carry a null subject", () => {
  for (const k of TICKET_KINDS) {
    if (k === FLAG_KIND) continue;
    const v = validateTicket({ message: "hi", kind: k });
    assert(v.ok, v.errors.join("; "));
    assertEquals(v.row!.subject_run_card_id, null, `${k} has no subject card`);
  }
});

Deno.test("insertPayload: omits subject_run_card_id unless there is one", () => {
  const plain = validateTicket({ message: "hi", kind: "question" });
  const plainPayload = insertPayload(plain.row!, "abc123");
  assert(
    !("subject_run_card_id" in plainPayload),
    "a pre-074 database must still accept the five legacy kinds",
  );
  assertEquals(plainPayload.ip_hash, "abc123");

  const flag = validateTicket({
    kind: "flag",
    message: "contaminated corpus",
    subject_run_card_id: CARD_ID,
  });
  const flagPayload = insertPayload(flag.row!, "abc123");
  assertEquals(flagPayload.subject_run_card_id, CARD_ID);
  assertEquals(flagPayload.kind, "flag");
});

Deno.test("insertPayload: never smuggles a server-owned column", () => {
  const v = validateTicket({ message: "hi", status: "closed", id: 9 } as Record<
    string,
    unknown
  >);
  const payload = insertPayload(v.row!, "hash");
  assertEquals(
    Object.keys(payload).sort(),
    ["contact_email", "ip_hash", "kind", "locale", "message", "page_url", "source"],
    "only the allowlist + the bound ip_hash reach the insert",
  );
});

Deno.test("buildEmailPayload: a flag names its card and is not urgent", () => {
  const v = validateTicket({
    kind: "flag",
    message: "the corpus sha does not match the registry",
    subject_run_card_id: CARD_ID,
  });
  assert(v.ok, v.errors.join("; "));
  const p = buildEmailPayload(v.row!, 31, "from@champollion.dev", "info@champollion.dev");
  assert(p.subject.includes(CARD_ID), "subject carries the flagged card id");
  assert(!p.subject.includes("URGENT"), "a flag is not a takedown");
  assert(p.text.includes(CARD_ID), "body carries the flagged card id");
  assert(
    p.text.includes("DATED edit BEFORE"),
    "the triage order is stated in the notification itself",
  );
  assertEquals(p.to, ["info@champollion.dev"], "one private inbox, nowhere else");
});

Deno.test("ackMessage: the flag reply promises no public counter", () => {
  const flag = validateTicket({
    kind: "flag",
    message: "gamed metric",
    subject_run_card_id: CARD_ID,
  });
  const text = ackMessage(flag.row!);
  assert(text.includes(CARD_ID), "tells the filer which card was flagged");
  assert(text.includes("no count"), "states that no count is public");
  assert(text.includes("disqualified"), "states the only visible outcome");

  const plain = validateTicket({ message: "hello" });
  assertEquals(
    ackMessage(plain.row!),
    "Thank you — your message has been recorded.",
    "non-flag wording is unchanged",
  );
});
