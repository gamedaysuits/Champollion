// docent-chat/lib.ts — pure request validation, prompt assembly, budget/rate
// decisions, and provider request/response shaping for the site docent. No I/O
// here: unit-tested by lib_test.ts (deno test lib_test.ts).

// ---- caps ------------------------------------------------------------------

export const MAX_BODY_BYTES = 128 * 1024; // 128 KB (history + question)
export const MAX_MESSAGE_CHARS = 2_000; // one visitor question
export const MAX_TURNS = 12; // client-held rolling history cap (server-enforced)
export const MAX_TURN_CHARS = 4_000; // per prior message
export const MAX_LOCALE_CHARS = 12;

export const DEFAULT_IP_HOURLY_CAP = 40; // a full conversation, not a firehose
export const DEFAULT_DAILY_OUTPUT_TOKEN_BUDGET = 500_000; // env-tunable

export const REGISTERS = new Set(["warm", "formal"]);

// ---- request validation ------------------------------------------------------

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatTurn[];
  locale: string;
  register: string;
}

export interface ChatValidation {
  ok: boolean;
  errors: string[];
  req: ChatRequest | null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Remove C0 control chars except tab/newline; trim. */
export function clean(s: string, singleLine = false): string {
  if (singleLine) {
    // deno-lint-ignore no-control-regex
    return s.replace(/[\x00-\x1F\x7F]+/g, " ").replace(/\s+/g, " ").trim();
  }
  // deno-lint-ignore no-control-regex
  return s.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "").trim();
}

/** Structural check on the generated grounding bundle. Returns null when the
 * bundle is usable, or a human-readable reason when it is not.
 *
 * The bundle (./_generated/docent-bundle.json) is BUILD OUTPUT and gitignored,
 * so a deploy from a clean checkout can ship a stale, truncated or renamed
 * file. The docent's contract is that it answers ONLY from this corpus — with
 * an empty corpus and an empty system prompt the model would answer from its
 * own weights instead, producing a fabricated answer that looks exactly like a
 * real one. index.ts refuses the model call whenever this returns non-null. */
// deno-lint-ignore no-explicit-any
export function validateBundle(b: any): string | null {
  if (!b || typeof b !== "object") return "bundle missing or not an object";
  if (!Array.isArray(b.chunks)) return "bundle.chunks missing or not an array";
  if (b.chunks.length === 0) {
    return "bundle.chunks is empty — nothing to ground answers in";
  }
  if (!Array.isArray(b.faq)) return "bundle.faq missing or not an array";
  if (typeof b.systemPrompt !== "string" || !b.systemPrompt.trim()) {
    return "bundle.systemPrompt missing or empty";
  }
  return null;
}

export function validateChatRequest(body: unknown): ChatValidation {
  const errors: string[] = [];
  if (!isPlainObject(body)) {
    return { ok: false, errors: ["body must be a JSON object"], req: null };
  }

  // message (required)
  let message = "";
  if (typeof body.message !== "string") {
    errors.push("message is required and must be a string");
  } else {
    message = clean(body.message, false);
    if (message.length === 0) errors.push("message must not be empty");
    if (message.length > MAX_MESSAGE_CHARS) {
      errors.push(`message exceeds ${MAX_MESSAGE_CHARS} chars`);
    }
  }

  // history (optional) — client-held, capped both ways
  const history: ChatTurn[] = [];
  if (body.history !== undefined && body.history !== null) {
    if (!Array.isArray(body.history)) {
      errors.push("history must be an array when present");
    } else {
      // keep only the most recent MAX_TURNS entries
      const recent = body.history.slice(-MAX_TURNS);
      for (const t of recent) {
        if (!isPlainObject(t)) continue;
        const role = t.role === "assistant" ? "assistant" : "user";
        const content = typeof t.content === "string"
          ? clean(t.content, false).slice(0, MAX_TURN_CHARS)
          : "";
        if (content) history.push({ role, content });
      }
    }
  }

  // locale (optional)
  let locale = "en";
  if (body.locale !== undefined && body.locale !== null && body.locale !== "") {
    if (typeof body.locale !== "string") {
      errors.push("locale must be a string when present");
    } else {
      locale = clean(body.locale, true).slice(0, MAX_LOCALE_CHARS) || "en";
    }
  }

  // register (optional)
  let register = "warm";
  if (typeof body.register === "string" && REGISTERS.has(body.register)) {
    register = body.register;
  }

  if (errors.length > 0) return { ok: false, errors, req: null };
  return { ok: true, errors: [], req: { message, history, locale, register } };
}

// ---- register selection ------------------------------------------------------

export interface RegisterBlocks {
  default_register?: string;
  shared_note?: string;
  locales: Record<string, Record<string, string>>;
}

/** Resolve the register-guidance block for (locale, register), with graceful
 * fallback: exact → locale/warm → en/register → en/warm → "". Always prefixed
 * with the shared note. */
export function pickRegisterBlock(
  blocks: RegisterBlocks,
  locale: string,
  register: string,
): string {
  const loc = blocks.locales?.[locale] ?? blocks.locales?.en ?? {};
  const en = blocks.locales?.en ?? {};
  const body = loc[register] ?? loc.warm ?? en[register] ?? en.warm ?? "";
  const shared = blocks.shared_note ? blocks.shared_note + "\n" : "";
  return (shared + body).trim();
}

// ---- prompt assembly ---------------------------------------------------------

export interface AssembledPrompt {
  system: string;
  messages: ChatTurn[];
}

/** Fill the system-prompt template and build the message list. The retrieved
 * context and register block are injected into the SYSTEM prompt (not user
 * turns) so they can't be overridden by conversation history. */
export function assemblePrompt(
  systemPromptTemplate: string,
  registerBlock: string,
  retrievedContext: string,
  history: ChatTurn[],
  message: string,
): AssembledPrompt {
  const system = systemPromptTemplate
    .replace("{{REGISTER_BLOCK}}", registerBlock || "(default warm register)")
    .replace("{{RETRIEVED_CONTEXT}}", retrievedContext);
  const messages: ChatTurn[] = [...history, { role: "user", content: message }];
  return { system, messages };
}

// ---- budget / rate decision --------------------------------------------------

export type DocentMode = "model" | "faq_only" | "rate_limited";

export interface BudgetDecision {
  mode: DocentMode;
  reason: string;
}

/** Decide how to serve this request. Order: per-IP rate cap → global daily
 * token budget → normal model answer. When the budget is exhausted we DEGRADE
 * to FAQ-only (honest, documented) rather than fail or overspend. */
export function budgetDecision(
  ipHourCount: number,
  ipHourlyCap: number,
  dailyOutputTokens: number,
  dailyBudget: number,
): BudgetDecision {
  if (ipHourCount >= ipHourlyCap) {
    return { mode: "rate_limited", reason: "ip_hourly" };
  }
  if (dailyOutputTokens >= dailyBudget) {
    return { mode: "faq_only", reason: "daily_budget" };
  }
  return { mode: "model", reason: "" };
}

// ---- provider request/response shaping --------------------------------------

export type Provider = "anthropic" | "openrouter";

export interface ModelCall {
  url: string;
  body: Record<string, unknown>;
  /** header names → values that are NOT secret (secret auth added by handler) */
  headers: Record<string, string>;
}

/** Build the HTTP call for a provider. The API key is added by the handler
 * (kept out of this pure builder). Anthropic uses a top-level `system`;
 * OpenRouter/OpenAI-style folds it into a system message. */
export function buildModelCall(
  provider: Provider,
  model: string,
  system: string,
  messages: ChatTurn[],
  maxTokens: number,
): ModelCall {
  if (provider === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: { "content-type": "application/json", "anthropic-version": "2023-06-01" },
      body: {
        model,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      },
    };
  }
  // openrouter (OpenAI-compatible)
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: {
      "content-type": "application/json",
      // privacy: never let the prompt be retained/trained on
      "x-openrouter-data-collection": "deny",
    },
    body: {
      model,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages],
      // OpenRouter honors provider routing prefs; deny data collection
      provider: { data_collection: "deny" },
    },
  };
}

export interface ModelResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** Parse a provider response into text + token usage. Tolerant of missing
 * usage fields (defaults to 0 — the ledger just under-counts, never crashes). */
export function parseModelResponse(provider: Provider, json: any): ModelResult {
  if (provider === "anthropic") {
    const text = Array.isArray(json?.content)
      ? json.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
      : "";
    return {
      text: (text ?? "").trim(),
      inputTokens: Number(json?.usage?.input_tokens ?? 0) || 0,
      outputTokens: Number(json?.usage?.output_tokens ?? 0) || 0,
    };
  }
  const text = json?.choices?.[0]?.message?.content ?? "";
  return {
    text: (text ?? "").trim(),
    inputTokens: Number(json?.usage?.prompt_tokens ?? 0) || 0,
    outputTokens: Number(json?.usage?.completion_tokens ?? 0) || 0,
  };
}

// ---- IP helpers (lockstep with submit-run / submit-ticket) ------------------

export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

/** Client IP for the rate-limit bucket.
 *
 * PLATFORM NOTE (measured on Supabase Edge Functions, 2026-07-26): requests
 * arrive through Cloudflare and x-forwarded-for looks like
 * "<client>,<client>, 99.83.104.48" — the LAST hop is an AWS egress address
 * that rotates per request, so keying on it (the submit-run H2 rule) gives
 * every request a fresh bucket and the per-IP cap silently never fires.
 * cf-connecting-ip is set by Cloudflare and overwrites any caller-supplied
 * value, so it is stable AND unspoofable here. See submit-ticket/lib.ts for the
 * full measurement. Matters more on this lane than on tickets: without it, one
 * visitor can drive model spend until the global daily token budget trips. */
export function clientIpFrom(headers: Headers, connectionIp = ""): string {
  const cf = (headers.get("cf-connecting-ip") ?? "").trim();
  if (isPublicIp(cf)) return cf;

  const xff = (headers.get("x-forwarded-for") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = xff.length - 1; i >= 0; i--) if (isPublicIp(xff[i])) return xff[i];
  const conn = connectionIp.trim();
  if (isPublicIp(conn)) return conn;
  return "unknown";
}
