// docent-chat — the champollion.dev site docent (founder direction 2026-07-20).
// A grounded, cost-metered, multilingual guide. It answers ONLY from the
// project's public docs (bundled in ./_generated/docent-bundle.json, built by
// cli/scripts/build-docent-corpus.mjs) and has NO tools — it explains and
// points, it cannot act. Deployed with verify_jwt DISABLED.
//
// Per request: validate → per-IP rate check + global daily token budget →
// FAQ short-circuit (free) → lexical retrieval → model answer (grounded).
// When the daily budget is exhausted, or a model isn't configured, it DEGRADES
// to an honest docs-and-ticket answer — never a silent 500, never a surprise
// bill, never a fabricated answer.
//
// Privacy: raw IPs are never stored (salted hash only), and NO conversation
// content is logged (docent_usage stores counters only, migration 066).
//
// Deploy + config: see ./README.md. Tests: deno test *_test.ts

// deno-lint-ignore-file no-explicit-any

import bundle from "./_generated/docent-bundle.json" with { type: "json" };
import {
  assemblePrompt,
  budgetDecision,
  buildModelCall,
  clientIpFrom,
  hashIp,
  MAX_BODY_BYTES,
  parseModelResponse,
  pickRegisterBlock,
  type Provider,
  validateBundle,
  validateChatRequest,
} from "./lib.ts";
import {
  buildIndex,
  faqMatch,
  renderContext,
  search,
} from "./retrieval.ts";

// ---- env -------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IP_SALT = Deno.env.get("DOCENT_IP_SALT") ?? "champollion-docent-v1";
const IP_HOURLY_CAP = Number(Deno.env.get("DOCENT_IP_HOURLY_CAP") ?? "40");
const DAILY_TOKEN_BUDGET = Number(Deno.env.get("DOCENT_DAILY_TOKEN_BUDGET") ?? "500000");
const MAX_TOKENS = Number(Deno.env.get("DOCENT_MAX_TOKENS") ?? "800");
const TOP_K = Number(Deno.env.get("DOCENT_TOP_K") ?? "6");

// Model selection: global default, per-locale override optional (bundle.modelConfig
// or DOCENT_MODEL_CONFIG env JSON, written by the eval program later).
const DEFAULT_PROVIDER = (Deno.env.get("DOCENT_PROVIDER") ?? "anthropic") as Provider;
const DEFAULT_MODEL = Deno.env.get("DOCENT_MODEL") ?? "claude-haiku-4-5";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";

let MODEL_CONFIG: Record<string, { provider: Provider; model: string }> = {};
try {
  MODEL_CONFIG = (bundle as any).modelConfig ??
    JSON.parse(Deno.env.get("DOCENT_MODEL_CONFIG") ?? "{}");
} catch { MODEL_CONFIG = {}; }

const ALLOWED_ORIGINS = (Deno.env.get("DOCENT_ALLOWED_ORIGINS") ??
  "https://champollion.dev,https://www.champollion.dev")
  .split(",").map((s) => s.trim()).filter(Boolean);

// ---- one-time index build (cold start) --------------------------------------
// The bundle is BUILD OUTPUT (cli/scripts/build-docent-corpus.mjs) and is
// gitignored, so a deploy from a clean checkout can ship a stale, truncated or
// key-renamed file. The old `?? []` / `?? ""` defaults turned exactly that into
// the worst possible failure: an empty index AND an empty system prompt, after
// which the model answered from its own weights — ungrounded, unsourced, and
// indistinguishable from a real answer. The docent's whole contract is that it
// answers ONLY from this corpus, so a bad bundle must never reach the model.
//
// Validated once at cold start. A failure does NOT crash the boot: killing the
// function would also take down the honest docs-and-ticket path that is this
// lane's designed fallback. Instead BUNDLE_ERROR latches, every request is
// forced down the degraded branch (reason "corpus_unavailable"), and the reason
// is logged on every cold start so it is loud in the function logs.
const CHUNKS = (bundle as any)?.chunks;
const FAQ = (bundle as any)?.faq;
const SYSTEM_PROMPT = (bundle as any)?.systemPrompt;
const REGISTER_BLOCKS = (bundle as any)?.registerBlocks ?? { locales: {} };

const BUNDLE_ERROR = validateBundle(bundle);
if (BUNDLE_ERROR) {
  console.error(
    `docent: REFUSING to answer from a model — ${BUNDLE_ERROR}. ` +
      "Rebuild with `node cli/scripts/build-docent-corpus.mjs` and redeploy. " +
      "Serving the honest docs-and-ticket answer until then.",
  );
}

const INDEX = buildIndex(Array.isArray(CHUNKS) ? CHUNKS : []);

// ---- helpers ----------------------------------------------------------------

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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
function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}
async function restCount(pathAndQuery: string): Promise<number> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method: "HEAD",
    headers: restHeaders({ Prefer: "count=exact" }),
  });
  if (!resp.ok) throw new Error(`count query failed (${resp.status})`);
  const n = Number((resp.headers.get("content-range") ?? "").split("/")[1]);
  return Number.isFinite(n) ? n : 0;
}
/** Sum of output_tokens over a window (the daily budget signal). */
async function sumOutputTokens(sinceIso: string): Promise<number> {
  // NOT PostgREST's `select=output_tokens.sum()` aggregate syntax: aggregates
  // are DISABLED on this project (`PGRST123 "Use of aggregate functions is not
  // allowed"`, PostgREST's default DoS guard). That threw on every request, and
  // the caller's fail-closed branch turned it into a blanket 503 — the docent
  // was hard-down for every visitor behind a "briefly unavailable" message.
  // Migration 067 provides a service-role-only RPC that does the sum in SQL.
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/docent_output_tokens_since`,
    {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({ since: sinceIso }),
    },
  );
  if (!resp.ok) throw new Error(`token sum rpc failed (${resp.status})`);
  const sum = Number(await resp.json());
  return Number.isFinite(sum) ? sum : 0;
}
async function logUsage(row: Record<string, unknown>): Promise<void> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/docent_usage`, {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify(row),
    });
    await resp.body?.cancel();
  } catch (err) {
    console.error("docent_usage log failed:", err); // never fatal
  }
}

/** Unique {title,url} sources from retrieved chunks (for the widget to render
 * citation links regardless of what the model wrote). */
function sourcesFrom(hits: { docTitle: string; url: string }[]): { title: string; url: string }[] {
  const seen = new Set<string>();
  const out: { title: string; url: string }[] = [];
  for (const h of hits) {
    const base = h.url.split("#")[0];
    if (seen.has(base)) continue;
    seen.add(base);
    out.push({ title: h.docTitle, url: h.url });
  }
  return out;
}

/** The honest degraded answer: no model call. Points at the retrieved docs and
 * the ticket form. Used when the daily budget is spent or no model is wired. */
function degradedAnswer(hits: any[], reason: string): { answer: string; sources: any[] } {
  const srcs = sourcesFrom(hits);
  const links = srcs.slice(0, 4).map((s) => `- ${s.title}: ${s.url}`).join("\n");
  const preface = reason === "daily_budget"
    ? "The live guide is resting for today to keep this project sustainable, but I can still point you to the right pages."
    : "The live guide isn't available right now, but here are the most relevant pages.";
  const answer = links
    ? `${preface}\n\nMost relevant docs:\n${links}\n\nIf you'd like a person to follow up, use the "Send a message" form in this panel — objections and takedown requests are especially welcome.`
    : `${preface}\n\nI don't have a matching page for that. You can send a message with the "Send a message" form in this panel and a human will follow up.`;
  return { answer, sources: srcs };
}

// ---- handler -----------------------------------------------------------------

async function handle(req: Request, connectionIp = ""): Promise<Response> {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") return json(405, { ok: false, error: "POST only" }, origin);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: `payload exceeds ${MAX_BODY_BYTES} bytes` }, origin);
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    return json(400, { ok: false, error: "body is not valid JSON" }, origin);
  }
  const v = validateChatRequest(body);
  if (!v.ok || !v.req) {
    return json(400, { ok: false, error: `validation: ${v.errors.join("; ")}` }, origin);
  }
  const { message, history, locale, register } = v.req;

  // ---- rate + budget ---------------------------------------------------------
  const ipHash = await hashIp(clientIpFrom(req.headers, connectionIp), IP_SALT);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  let mode: string, decisionReason: string;
  try {
    const [ipCount, dailyTokens] = await Promise.all([
      restCount(`docent_usage?ip_hash=eq.${ipHash}&created_at=gte.${hourAgo}&select=id`),
      sumOutputTokens(dayAgo),
    ]);
    const d = budgetDecision(ipCount, IP_HOURLY_CAP, dailyTokens, DAILY_TOKEN_BUDGET);
    mode = d.mode;
    decisionReason = d.reason;
  } catch (err) {
    console.error("docent budget/rate query failed:", err);
    return json(503, {
      ok: false,
      error: "the guide is briefly unavailable — please try again shortly, or " +
        "browse the docs directly.",
    }, origin);
  }
  if (mode === "rate_limited") {
    return json(429, {
      ok: false,
      error: "You've sent a lot of messages in a short time. Please pause a " +
        "moment — or browse the docs directly. The guide will be back shortly.",
      retry_after_seconds: 3600,
    }, origin);
  }

  // ---- FAQ short-circuit (free; served in any mode) --------------------------
  const faq = faqMatch(message, Array.isArray(FAQ) ? FAQ : []);
  if (faq) {
    await logUsage({ ip_hash: ipHash, locale, model: "faq", faq_hit: true, input_tokens: 0, output_tokens: 0 });
    return json(200, {
      ok: true,
      mode: "faq",
      answer: faq.entry.answer,
      sources: (faq.entry.sources ?? []).map((s: string) => ({
        title: faq.entry.question,
        url: s.startsWith("http") ? s : `https://champollion.dev${s}`,
      })),
    }, origin);
  }

  // ---- retrieve --------------------------------------------------------------
  const hits = search(INDEX, message, TOP_K);

  // ---- degraded modes (no model call) ----------------------------------------
  const provider = MODEL_CONFIG[locale]?.provider ?? DEFAULT_PROVIDER;
  const model = MODEL_CONFIG[locale]?.model ?? DEFAULT_MODEL;
  const apiKey = provider === "anthropic" ? ANTHROPIC_API_KEY : OPENROUTER_API_KEY;

  // BUNDLE_ERROR is checked FIRST and is unconditional: with no corpus there is
  // nothing to ground an answer in, so calling the model could only produce a
  // fabricated one. Refuse the model outright rather than degrade quality
  // silently. (hits is necessarily empty here, so degradedAnswer falls through
  // to its no-matching-page text plus the ticket form.)
  if (mode === "faq_only" || BUNDLE_ERROR || !apiKey) {
    const reason = BUNDLE_ERROR
      ? "corpus_unavailable"
      : (mode === "faq_only" ? "daily_budget" : "unconfigured");
    const { answer, sources } = degradedAnswer(hits, reason);
    await logUsage({ ip_hash: ipHash, locale, model: `degraded:${reason}`, faq_hit: false, input_tokens: 0, output_tokens: 0 });
    if (BUNDLE_ERROR) {
      console.error("docent: serving degraded answer —", BUNDLE_ERROR);
    } else if (!apiKey && mode !== "faq_only") {
      console.error("docent: no API key for provider", provider, "- serving degraded answer");
    }
    return json(200, { ok: true, mode: "degraded", degraded_reason: reason, answer, sources }, origin);
  }

  // ---- model answer (grounded) -----------------------------------------------
  const registerBlock = pickRegisterBlock(REGISTER_BLOCKS, locale, register);
  const { system, messages } = assemblePrompt(
    SYSTEM_PROMPT, registerBlock, renderContext(hits), history, message,
  );
  const call = buildModelCall(provider, model, system, messages, MAX_TOKENS);

  let result;
  try {
    const resp = await fetch(call.url, {
      method: "POST",
      headers: {
        ...call.headers,
        ...(provider === "anthropic"
          ? { "x-api-key": apiKey }
          : { Authorization: `Bearer ${apiKey}` }),
      },
      body: JSON.stringify(call.body),
    });
    if (!resp.ok) {
      const detail = (await resp.text()).slice(0, 300);
      console.error(`docent model call failed (${resp.status}):`, detail);
      // Never surface a raw upstream error or fabricate — degrade honestly.
      const { answer, sources } = degradedAnswer(hits, "unconfigured");
      await logUsage({ ip_hash: ipHash, locale, model: `error:${resp.status}`, faq_hit: false, input_tokens: 0, output_tokens: 0 });
      return json(200, { ok: true, mode: "degraded", degraded_reason: "model_error", answer, sources }, origin);
    }
    result = parseModelResponse(provider, await resp.json());
  } catch (err) {
    console.error("docent model call errored:", err);
    const { answer, sources } = degradedAnswer(hits, "unconfigured");
    await logUsage({ ip_hash: ipHash, locale, model: "error:exception", faq_hit: false, input_tokens: 0, output_tokens: 0 });
    return json(200, { ok: true, mode: "degraded", degraded_reason: "model_error", answer, sources }, origin);
  }

  await logUsage({
    ip_hash: ipHash, locale, model,
    faq_hit: false,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
  });

  return json(200, {
    ok: true,
    mode: "model",
    answer: result.text,
    sources: sourcesFrom(hits),
  }, origin);
}

Deno.serve(
  async (req: Request, info?: { remoteAddr?: { hostname?: string } }) => {
    try {
      return await handle(req, info?.remoteAddr?.hostname ?? "");
    } catch (err) {
      console.error("docent-chat failed:", err);
      return json(500, { ok: false, error: String(err) }, req.headers.get("origin"));
    }
  },
);
