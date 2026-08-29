// lib_test.ts — deno test suite for the anonymous intake validation.
//
//   deno test lib_test.ts
//
// Dependency-free on purpose (the repo's gates run offline), matching
// ../regenerate-queue/lib_test.ts.

import {
  ALLOWED_CARD_COLUMNS,
  ALLOWED_ENTRY_COLUMNS,
  bindEntries,
  clientIpFrom,
  hashIp,
  isValidCardId,
  MAX_ENTRIES,
  MAX_ENTRY_TEXT_CHARS,
  rateLimitDecision,
  rateLimitMessage,
  validateSubmission,
} from "./lib.ts";

// ---- tiny assert helpers (no deps) ------------------------------------------

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertEquals(actual: unknown, expected: unknown, msg = ""): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg}\n  actual:   ${a}\n  expected: ${e}`);
  }
}

// ---- fixtures -----------------------------------------------------------------

/** Minimal valid run_card_row, as build_run_card_row would emit it. */
function validRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "a3f8c2d1-4b5e-4f6a-8b7c-9d0e1f2a3b4c",
    submitter: "Mallory J. Attacker", // must be overridden to 'anonymous'
    trust: "verified", //               must be forced back to 'unverified'
    affirmation: "I promise",
    model_slug: "anthropic/claude-haiku-4.5",
    condition: "naive",
    dataset_id: "flores200-eng-zul",
    language_pair: "eng>zul",
    harness_version: "0.9.0",
    chrf_plus_plus: 41.2,
    total_cost_usd: 0.02,
    run_card: { overall: { evaluated: 50 } },
    fingerprint_hash: "deadbeef".repeat(8),
    ...overrides,
  };
}

// ---- validateSubmission: happy path ------------------------------------------

Deno.test("valid payload passes and forces the anonymous identity", () => {
  const v = validateSubmission({ run_card_row: validRow() });
  assert(v.ok, v.errors.join("; "));
  assert(v.row);
  // The honesty rail: whatever the caller claimed is overwritten.
  assertEquals(v.row.submitter, "anonymous");
  assertEquals(v.row.trust, "unverified");
  assertEquals(v.row.owner_uid, null);
  assert(
    String(v.row.affirmation).includes("anonymous public intake"),
    "affirmation must be the server-built anonymous one",
  );
  // Passthrough fields survive.
  assertEquals(v.row.chrf_plus_plus, 41.2);
  assertEquals(v.row.dataset_id, "flores200-eng-zul");
});

Deno.test("unknown columns are dropped (never reach PostgREST)", () => {
  const v = validateSubmission({
    run_card_row: validRow({
      evil_column: "x",
      role: "service_role",
      verified_by: "me",
    }),
  });
  assert(v.ok);
  assert(v.row);
  assert(!("evil_column" in v.row));
  assert(!("role" in v.row));
  assert(!("verified_by" in v.row));
});

Deno.test("owner_uid in the payload cannot claim a uid", () => {
  const v = validateSubmission({
    run_card_row: validRow({ owner_uid: "11111111-2222-3333-4444-555555555555" }),
  });
  assert(v.ok);
  assert(v.row);
  assertEquals(v.row.owner_uid, null);
});

// ---- validateSubmission: rejections -------------------------------------------

Deno.test("non-object bodies are rejected", () => {
  for (const bad of [null, 42, "hi", [1, 2]]) {
    const v = validateSubmission(bad);
    assert(!v.ok);
  }
});

Deno.test("missing run_card_row is rejected", () => {
  const v = validateSubmission({ entries: [] });
  assert(!v.ok);
  assert(v.errors[0].includes("run_card_row"));
});

Deno.test("each missing required field is named", () => {
  const row = validRow();
  delete (row as Record<string, unknown>).model_slug;
  delete (row as Record<string, unknown>).fingerprint_hash;
  const v = validateSubmission({ run_card_row: row });
  assert(!v.ok);
  assert(v.errors.some((e) => e.includes("model_slug")));
  assert(v.errors.some((e) => e.includes("fingerprint_hash")));
});

Deno.test("empty-string required fields are rejected; empty condition is fine", () => {
  const bad = validateSubmission({
    run_card_row: validRow({ dataset_id: "   " }),
  });
  assert(!bad.ok);
  assert(bad.errors.some((e) => e.includes("dataset_id")));

  // condition="" is a legitimate NOT NULL empty string (publish.py
  // REQUIRED_NOT_NULL_FIELDS).
  const ok = validateSubmission({ run_card_row: validRow({ condition: "" }) });
  assert(ok.ok, ok.errors.join("; "));

  const missing = validateSubmission({
    run_card_row: validRow({ condition: null }),
  });
  assert(!missing.ok);
});

Deno.test("junk ids are rejected", () => {
  for (const badId of ["short", "x".repeat(30), "id; DROP TABLE run_cards", 42]) {
    assert(!isValidCardId(badId), `should reject: ${badId}`);
  }
  assert(isValidCardId("a3f8c2d1-4b5e-4f6a-8b7c-9d0e1f2a3b4c"));
  assert(isValidCardId("deadbeefdeadbeefdeadbeef"));
});

Deno.test("non-finite numerics are rejected", () => {
  const v = validateSubmission({
    run_card_row: validRow({ chrf_plus_plus: "41.2" }),
  });
  assert(!v.ok);
  assert(v.errors.some((e) => e.includes("chrf_plus_plus")));
});

Deno.test("vacuous run_card object is rejected as missing", () => {
  const v = validateSubmission({ run_card_row: validRow({ run_card: {} }) });
  assert(!v.ok);
  assert(v.errors.some((e) => e.includes("run_card")));
});

// ---- entries -------------------------------------------------------------------

Deno.test("entries are allowlisted and bound to the card id", () => {
  const v = validateSubmission({
    run_card_row: validRow(),
    entries: [
      {
        entry_id: "e1",
        source: "hello",
        expected: "sawubona",
        predicted: "sawubona",
        exact_match: true,
        chrf_score: 100,
        sneaky_column: "x",
      },
    ],
  });
  assert(v.ok, v.errors.join("; "));
  assertEquals(v.entries.length, 1);
  assert(!("sneaky_column" in v.entries[0]));
  const bound = bindEntries(v.entries, "card-123");
  assertEquals(bound[0].run_card_id, "card-123");
  assertEquals(bound[0].entry_id, "e1");
});

Deno.test("entry count cap enforced", () => {
  const entries = Array.from({ length: MAX_ENTRIES + 1 }, (_, i) => ({
    entry_id: `e${i}`,
  }));
  const v = validateSubmission({ run_card_row: validRow(), entries });
  assert(!v.ok);
  assert(v.errors.some((e) => e.includes("exceeds the cap")));
});

Deno.test("oversized entry text fields rejected", () => {
  const v = validateSubmission({
    run_card_row: validRow(),
    entries: [{ entry_id: "e1", source: "x".repeat(MAX_ENTRY_TEXT_CHARS + 1) }],
  });
  assert(!v.ok);
  assert(v.errors.some((e) => e.includes("source")));
});

Deno.test("non-array entries rejected", () => {
  const v = validateSubmission({
    run_card_row: validRow(),
    entries: { entry_id: "e1" },
  });
  assert(!v.ok);
});

// ---- allowlist sanity -----------------------------------------------------------

Deno.test("forced identity columns are NOT in the client allowlist", () => {
  for (const col of ["submitter", "trust", "owner_uid", "affirmation"]) {
    assert(!ALLOWED_CARD_COLUMNS.has(col), `${col} must not be allowlisted`);
  }
  assert(!ALLOWED_ENTRY_COLUMNS.has("run_card_id"));
});

// ---- rate limiting ---------------------------------------------------------------

Deno.test("rateLimitDecision windows", () => {
  assertEquals(rateLimitDecision(0, 0, 5, 200), { allowed: true, reason: "" });
  assertEquals(rateLimitDecision(4, 199, 5, 200), { allowed: true, reason: "" });
  assertEquals(rateLimitDecision(5, 0, 5, 200), {
    allowed: false,
    reason: "ip_hourly",
  });
  assertEquals(rateLimitDecision(0, 200, 5, 200), {
    allowed: false,
    reason: "global_daily",
  });
});

Deno.test("rate-limit message points at sign-in and never loses work", () => {
  for (const reason of ["ip_hourly", "global_daily"] as const) {
    const msg = rateLimitMessage(reason);
    assert(msg.includes("sign in"), msg);
    assert(msg.includes("NOT lost"), msg);
    assert(msg.includes("mt-eval publish"), msg);
  }
});

Deno.test("hashIp is stable, salted, and never the raw IP", async () => {
  const a = await hashIp("203.0.113.7", "salt1");
  const b = await hashIp("203.0.113.7", "salt1");
  const c = await hashIp("203.0.113.7", "salt2");
  assertEquals(a, b);
  assert(a !== c, "different salts must give different hashes");
  assert(!a.includes("203"), "raw IP must not appear in the hash");
  assert(/^[0-9a-f]{64}$/.test(a));
});

Deno.test("clientIpFrom takes the LAST public x-forwarded-for hop (H2)", () => {
  // The platform appends the true peer; anything the client sent sits LEFT
  // of it. A spoofed leftmost hop must never win.
  const spoofed = new Headers({
    "x-forwarded-for": "6.6.6.6, 198.51.100.7, 10.0.0.1",
  });
  assertEquals(clientIpFrom(spoofed), "198.51.100.7");
  // Internal proxy hops (private ranges) on the right are skipped.
  const internal = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
  assertEquals(clientIpFrom(internal), "203.0.113.7");
  // No XFF → connection peer, when public.
  assertEquals(clientIpFrom(new Headers(), "198.51.100.9"), "198.51.100.9");
  // Private connection peer → the shared fail-contained bucket.
  assertEquals(clientIpFrom(new Headers(), "172.20.0.4"), "unknown");
  assertEquals(clientIpFrom(new Headers()), "unknown");
  // All-private XFF (only junk + internals) → connection peer, else unknown.
  const junk = new Headers({ "x-forwarded-for": "not-an-ip, 192.168.1.5" });
  assertEquals(clientIpFrom(junk, "2001:db8::1"), "2001:db8::1");
  assertEquals(clientIpFrom(junk), "unknown");
});

Deno.test("clientIpFrom: cf-connecting-ip keeps the anon-publish bucket stable", () => {
  // Measured on Supabase Edge 2026-07-26 (docent lane): behind Cloudflare the
  // LAST x-forwarded-for hop is an AWS egress address that ROTATES PER
  // REQUEST. Keying on it hands every request a fresh bucket, so the 5/hour
  // per-IP cap silently never fires and one visitor can flood the board.
  // Same visitor, two rotated egress hops -> must be ONE bucket.
  const a = new Headers({
    "cf-connecting-ip": "143.44.145.174",
    "x-forwarded-for": "143.44.145.174, 143.44.145.174, 99.83.104.48",
  });
  const b = new Headers({
    "cf-connecting-ip": "143.44.145.174",
    "x-forwarded-for": "143.44.145.174, 143.44.145.174, 99.83.157.99",
  });
  assertEquals(clientIpFrom(a), "143.44.145.174");
  assertEquals(clientIpFrom(a), clientIpFrom(b), "same visitor -> same bucket");

  // A private/bogus cf-connecting-ip must not win — fall through to the XFF scan.
  assertEquals(
    clientIpFrom(new Headers({
      "cf-connecting-ip": "10.0.0.1",
      "x-forwarded-for": "1.2.3.4, 8.8.8.8",
    })),
    "8.8.8.8",
  );
  // Absent cf-connecting-ip → unchanged H2 behaviour.
  assertEquals(
    clientIpFrom(new Headers({ "x-forwarded-for": "6.6.6.6, 198.51.100.7" })),
    "198.51.100.7",
  );
});
