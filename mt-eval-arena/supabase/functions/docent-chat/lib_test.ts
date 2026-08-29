// lib_test.ts — deno test suite for docent-chat request/prompt/budget/provider
// logic.  deno test lib_test.ts

import {
  assemblePrompt,
  budgetDecision,
  buildModelCall,
  clientIpFrom,
  hashIp,
  isPublicIp,
  MAX_MESSAGE_CHARS,
  MAX_TURNS,
  parseModelResponse,
  pickRegisterBlock,
  type RegisterBlocks,
  validateBundle,
  validateChatRequest,
} from "./lib.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals(a: unknown, b: unknown, msg = ""): void {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg}\n  actual:   ${JSON.stringify(a)}\n  expected: ${JSON.stringify(b)}`);
  }
}

// ---- validateChatRequest -----------------------------------------------------

Deno.test("validateChatRequest: minimal valid", () => {
  const v = validateChatRequest({ message: "what is champollion?" });
  assert(v.ok, v.errors.join("; "));
  assertEquals(v.req!.locale, "en");
  assertEquals(v.req!.register, "warm");
  assertEquals(v.req!.history, []);
});

Deno.test("validateChatRequest: rejects empty / missing / oversized message", () => {
  assert(!validateChatRequest({}).ok);
  assert(!validateChatRequest({ message: "" }).ok);
  assert(!validateChatRequest({ message: "x".repeat(MAX_MESSAGE_CHARS + 1) }).ok);
});

Deno.test("validateChatRequest: history is capped to the most recent MAX_TURNS", () => {
  const hist = Array.from({ length: MAX_TURNS + 8 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: `turn ${i}`,
  }));
  const v = validateChatRequest({ message: "next", history: hist });
  assert(v.ok, v.errors.join("; "));
  assertEquals(v.req!.history.length, MAX_TURNS, "trimmed to cap");
  assertEquals(v.req!.history[0].content, `turn 8`, "kept the most recent");
});

Deno.test("validateChatRequest: bad register falls back to warm; junk history entries dropped", () => {
  const v = validateChatRequest({
    message: "hi",
    register: "sarcastic",
    history: [{ role: "user", content: "ok" }, "nope", { role: "x" }],
  });
  assert(v.ok, v.errors.join("; "));
  assertEquals(v.req!.register, "warm");
  assertEquals(v.req!.history.length, 1, "only the well-formed turn survives");
});

Deno.test("validateChatRequest: strips control chars from message", () => {
  const v = validateChatRequest({ message: "hel\x00lo\x07 there" });
  assert(v.ok);
  assertEquals(v.req!.message, "hello there");
});

// ---- pickRegisterBlock -------------------------------------------------------

const BLOCKS: RegisterBlocks = {
  default_register: "warm",
  shared_note: "SHARED.",
  locales: {
    en: { warm: "EN-WARM", formal: "EN-FORMAL" },
    fil: { warm: "FIL-WARM (Taglish ok)", formal: "FIL-FORMAL" },
  },
};

Deno.test("pickRegisterBlock: exact, fallback to warm, fallback to en", () => {
  assert(pickRegisterBlock(BLOCKS, "fil", "warm").includes("FIL-WARM"));
  assert(pickRegisterBlock(BLOCKS, "fil", "formal").includes("FIL-FORMAL"));
  // unknown register for fil -> fil.warm
  assert(pickRegisterBlock(BLOCKS, "fil", "bogus").includes("FIL-WARM"));
  // unknown locale -> en.warm
  assert(pickRegisterBlock(BLOCKS, "xx", "warm").includes("EN-WARM"));
  // shared note is always prefixed
  assert(pickRegisterBlock(BLOCKS, "en", "warm").startsWith("SHARED."));
});

// ---- assemblePrompt ----------------------------------------------------------

Deno.test("assemblePrompt: fills both placeholders and appends the user turn", () => {
  const tmpl = "RULES {{REGISTER_BLOCK}} CTX {{RETRIEVED_CONTEXT}}";
  const { system, messages } = assemblePrompt(
    tmpl,
    "REG",
    "CONTEXT-HERE",
    [{ role: "user", content: "earlier" }, { role: "assistant", content: "reply" }],
    "now",
  );
  assertEquals(system, "RULES REG CTX CONTEXT-HERE");
  assertEquals(messages.length, 3);
  assertEquals(messages[2], { role: "user", content: "now" });
});

// ---- budgetDecision ----------------------------------------------------------

Deno.test("budgetDecision: rate limit > budget > model", () => {
  assertEquals(budgetDecision(0, 40, 0, 500_000), { mode: "model", reason: "" });
  assertEquals(budgetDecision(40, 40, 0, 500_000), { mode: "rate_limited", reason: "ip_hourly" });
  assertEquals(budgetDecision(1, 40, 500_000, 500_000), { mode: "faq_only", reason: "daily_budget" });
  // rate limit takes precedence over budget
  assertEquals(budgetDecision(40, 40, 999_999, 500_000), { mode: "rate_limited", reason: "ip_hourly" });
});

// ---- provider shaping --------------------------------------------------------

Deno.test("buildModelCall: anthropic uses top-level system", () => {
  const call = buildModelCall("anthropic", "claude-haiku-4-5", "SYS", [{ role: "user", content: "hi" }], 800);
  assert(call.url.includes("api.anthropic.com"));
  assertEquals(call.body.system, "SYS");
  assertEquals((call.body.messages as unknown[]).length, 1);
  assert(call.headers["anthropic-version"], "carries version header");
});

Deno.test("buildModelCall: openrouter folds system into messages + denies data collection", () => {
  const call = buildModelCall("openrouter", "meta-llama/x", "SYS", [{ role: "user", content: "hi" }], 800);
  assert(call.url.includes("openrouter.ai"));
  const msgs = call.body.messages as { role: string; content: string }[];
  assertEquals(msgs[0], { role: "system", content: "SYS" });
  assertEquals((call.body.provider as any).data_collection, "deny");
});

Deno.test("parseModelResponse: anthropic + openrouter shapes", () => {
  const a = parseModelResponse("anthropic", {
    content: [{ type: "text", text: "hello" }, { type: "thinking", text: "x" }],
    usage: { input_tokens: 10, output_tokens: 5 },
  });
  assertEquals(a, { text: "hello", inputTokens: 10, outputTokens: 5 });
  const o = parseModelResponse("openrouter", {
    choices: [{ message: { content: "hey" } }],
    usage: { prompt_tokens: 7, completion_tokens: 3 },
  });
  assertEquals(o, { text: "hey", inputTokens: 7, outputTokens: 3 });
  // missing usage -> zeros, never crash
  assertEquals(parseModelResponse("anthropic", {}), { text: "", inputTokens: 0, outputTokens: 0 });
});

// ---- IP helpers --------------------------------------------------------------

Deno.test("clientIpFrom / isPublicIp / hashIp", async () => {
  assert(isPublicIp("8.8.8.8"));
  assert(!isPublicIp("192.168.0.1"));
  assertEquals(clientIpFrom(new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.1, 8.8.8.8" })), "8.8.8.8");
  const h = await hashIp("8.8.8.8", "s");
  assert(/^[0-9a-f]{64}$/.test(h));
});

Deno.test("clientIpFrom: cf-connecting-ip keeps the spend bucket stable", () => {
  // On Supabase/Cloudflare the last XFF hop is a per-request AWS egress address,
  // so keying on it gave every request a fresh bucket and the per-IP cap never
  // fired — on THIS lane that means one visitor can drive model spend until the
  // global daily token budget trips. cf-connecting-ip is stable + unspoofable.
  const a = new Headers({
    "cf-connecting-ip": "143.44.145.174",
    "x-forwarded-for": "143.44.145.174,143.44.145.174, 99.82.170.173",
  });
  const b = new Headers({
    "cf-connecting-ip": "143.44.145.174",
    "x-forwarded-for": "143.44.145.174,143.44.145.174, 99.83.104.48",
  });
  assertEquals(clientIpFrom(a), "143.44.145.174");
  assertEquals(clientIpFrom(a), clientIpFrom(b), "same visitor -> same bucket");
  // A private cf header must not override the XFF walk.
  assertEquals(
    clientIpFrom(new Headers({ "cf-connecting-ip": "10.0.0.1", "x-forwarded-for": "1.2.3.4, 8.8.8.8" })),
    "8.8.8.8",
  );
});

Deno.test("validateBundle: a bad bundle is caught, never silently defaulted", () => {
  // The failure this guards: the old `?? []` / `?? ""` defaults turned a
  // stale/truncated/renamed bundle into an empty index AND an empty system
  // prompt, after which the model answered from its own weights — ungrounded
  // and indistinguishable from a real answer. index.ts refuses the model call
  // whenever this returns non-null.
  const good = {
    chunks: [{ id: "a", title: "A", url: "/docs/a", text: "hello" }],
    faq: [],
    systemPrompt: "You are the Champollion docent.",
  };
  assertEquals(validateBundle(good), null);

  // Each way a bad bundle can arrive must be REPORTED, not defaulted away.
  for (const bad of [
    undefined,
    null,
    "not-an-object",
    {},                                       // no chunks
    { ...good, chunks: [] },                  // built, but empty corpus
    { ...good, chunks: "nope" },              // renamed/retyped key
    { ...good, faq: undefined },              // missing faq
    { ...good, systemPrompt: "" },            // empty prompt
    { ...good, systemPrompt: "   " },         // whitespace-only prompt
    { ...good, systemPrompt: undefined },     // renamed prompt key
  ]) {
    const reason = validateBundle(bad);
    assertEquals(
      typeof reason === "string" && reason.length > 0,
      true,
      `expected a reason for ${JSON.stringify(bad)}`,
    );
  }
});
