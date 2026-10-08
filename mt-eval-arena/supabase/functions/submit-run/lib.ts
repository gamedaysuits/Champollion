// submit-run/lib.ts — pure validation + rate-limit logic for the anonymous
// run-card intake. No I/O here: everything in this file is unit-tested by
// ./lib_test.ts (deno test lib_test.ts), dependency-free like
// ../regenerate-queue/lib_test.ts.
//
// SSOT NOTE. The column allowlists below mirror the Python row builders —
// run_cards columns from mt_eval_harness/publish.py `build_run_card_row`
// (+ the method-taxonomy keys its `_resolve_method_taxonomy` spread adds),
// run_card_entries columns from `_build_entry_rows` (+ the denormalized LYSS
// verdict columns `_extract_lyss_verdicts` can emit). Change them together.
// Anything NOT in the allowlist is silently dropped — an anonymous caller
// can never smuggle an unexpected column (e.g. owner_uid, trust) into the
// insert, and PostgREST never sees keys it would reject.

// ---- caps ------------------------------------------------------------------

/** Hard cap on the request body, bytes. A run card with full entries for the
 * largest registered corpora fits comfortably; anything bigger is not a
 * legitimate single-run payload. */
export const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

/** Hard cap on per-entry rows in one submission. */
export const MAX_ENTRIES = 2000;

/** Hard cap on any single text field inside an entry (source/expected/
 * predicted/raw_predicted/error). Longest registered corpus segments are
 * hundreds of chars; 20k is generous without inviting blob-stuffing. */
export const MAX_ENTRY_TEXT_CHARS = 20_000;

/** Default rate limits (env-overridable in index.ts). */
export const DEFAULT_IP_HOURLY_CAP = 5;
export const DEFAULT_GLOBAL_DAILY_CAP = 200;

// ---- run_cards column allowlist -------------------------------------------

/** Every column build_run_card_row (publish.py) writes, EXCEPT the three the
 * server forces for this lane (submitter / trust / affirmation) and owner_uid
 * (never client-settable; the insert sets it to null explicitly). */
export const ALLOWED_CARD_COLUMNS: ReadonlySet<string> = new Set([
  "id",
  "model_slug",
  "condition",
  "dataset_id",
  "language_pair",
  "harness_version",
  "chrf_plus_plus",
  "corpus_bleu",
  "exact_match_rate",
  "fst_acceptance_rate",
  "equivalent_match_rate",
  "semantic_score",
  "composite_score",
  "quality_tier",
  "comet_score",
  "qe_score",
  "has_references",
  "morphological_accuracy",
  "morph_coverage",
  "chrf_ci_lower",
  "chrf_ci_upper",
  "exact_match_ci_lower",
  "exact_match_ci_upper",
  "fst_ci_lower",
  "fst_ci_upper",
  "composite_ci_lower",
  "composite_ci_upper",
  "total_cost_usd",
  "cost_per_entry_usd",
  "elapsed_seconds",
  "avg_latency_seconds",
  "corpus_size",
  "run_card",
  "fingerprint_hash",
  "api_provider",
  "run_timestamp",
  "batch_size",
  "temperature",
  "max_tokens",
  "method_class",
  "paradigm",
  "ter",
  "length_ratio",
  "tokens_per_second",
  "entries_per_minute",
  "cost_per_source_char",
  "median_latency_seconds",
  "p95_latency_seconds",
  "tokens_per_entry",
  "cost_per_1k_tokens",
  "code_switching_rate",
  "hallucination_rate",
  "terminology_adherence",
  "style_consistency_rate",
  "corpus_license",
  "corpus_attribution",
]);

/** NOT NULL columns that must arrive non-empty (publish.py
 * REQUIRED_ROW_FIELDS, minus the server-forced submitter/trust/affirmation). */
export const REQUIRED_CARD_FIELDS: readonly string[] = [
  "id",
  "model_slug",
  "dataset_id",
  "language_pair",
  "harness_version",
  "run_card",
  "fingerprint_hash",
];

/** NOT NULL columns where empty string is valid; only missing is an error. */
export const REQUIRED_NOT_NULL_FIELDS: readonly string[] = ["condition"];

// ---- run_card_entries column allowlist -------------------------------------

/** _build_entry_rows keys (minus run_card_id, which the server binds itself)
 * plus the _extract_lyss_verdicts denormalized columns. */
export const ALLOWED_ENTRY_COLUMNS: ReadonlySet<string> = new Set([
  "entry_id",
  "source",
  "expected",
  "raw_predicted",
  "predicted",
  "segment",
  "difficulty",
  "domain",
  "exact_match",
  "chrf_score",
  "bleu_score",
  "latency_s",
  "cost_usd",
  "tool_call_count",
  "error",
  "plugin_metrics",
  // LYSS verdict denormalizations (migration 006 columns)
  "fst_valid",
  "equivalent_match",
  "semantic_verdict",
  "code_switching_detected",
  "hallucination_detected",
]);

const ENTRY_TEXT_FIELDS: readonly string[] = [
  "source",
  "expected",
  "raw_predicted",
  "predicted",
  "error",
];

// ---- validation -------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** Sanitized run_cards row (allowlisted + forced identity fields). */
  row: Record<string, unknown> | null;
  /** Sanitized run_card_entries rows WITHOUT run_card_id (bound later). */
  entries: Record<string, unknown>[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteOrNull(v: unknown): boolean {
  return v === null || v === undefined ||
    (typeof v === "number" && Number.isFinite(v));
}

/** The card id is a deterministic fingerprint UUID (publish.py). Accept a
 * conservative id shape: hex + dashes, 20–64 chars — matching the RLS
 * length(id) > 10 floor with headroom, rejecting free-text junk ids. */
export function isValidCardId(id: unknown): boolean {
  return typeof id === "string" && /^[0-9a-fA-F-]{20,64}$/.test(id) &&
    /[0-9a-fA-F]/.test(id);
}

/** Validate + sanitize one anonymous submission payload.
 *
 * Shape: { run_card_row: {...build_run_card_row output...},
 *          entries?: [...entry rows...] }
 *
 * The returned row has submitter/trust/affirmation/owner_uid FORCED to the
 * anonymous-lane values regardless of what the caller sent — attribution is
 * never fabricated, and an anonymous submission can never claim a name, an
 * elevated trust tier, or someone's uid. Numeric range checks beyond
 * finiteness are deliberately NOT re-implemented here: migration 023's
 * score-integrity trigger is the un-bypassable SSOT for ranges.
 */
export function validateSubmission(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(body)) {
    return { ok: false, errors: ["body must be a JSON object"], row: null, entries: [] };
  }

  const rawRow = body.run_card_row;
  if (!isPlainObject(rawRow)) {
    return {
      ok: false,
      errors: ["run_card_row is required and must be an object"],
      row: null,
      entries: [],
    };
  }

  // Allowlist columns — silently drop everything else (including any
  // attempt to set submitter/trust/owner_uid/affirmation directly).
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawRow)) {
    if (ALLOWED_CARD_COLUMNS.has(k)) row[k] = v;
  }

  // Required fields.
  for (const f of REQUIRED_CARD_FIELDS) {
    const v = row[f];
    if (
      v === null || v === undefined ||
      (typeof v === "string" && v.trim() === "") ||
      (isPlainObject(v) && Object.keys(v).length === 0)
    ) {
      errors.push(`missing required field: ${f}`);
    }
  }
  for (const f of REQUIRED_NOT_NULL_FIELDS) {
    if (row[f] === null || row[f] === undefined) {
      errors.push(`missing required field: ${f}`);
    }
  }

  if (row.id !== undefined && !isValidCardId(row.id)) {
    errors.push("id must be a 20-64 char fingerprint UUID (hex + dashes)");
  }
  if (row.run_card !== undefined && !isPlainObject(row.run_card)) {
    errors.push("run_card must be an object");
  }

  // Type sanity for numeric columns — anything present must be a finite
  // number (range enforcement is the 023 trigger's job).
  for (const k of Object.keys(row)) {
    if (
      k === "id" || k === "run_card" || k === "quality_tier" ||
      k === "model_slug" || k === "condition" || k === "dataset_id" ||
      k === "language_pair" || k === "harness_version" ||
      k === "fingerprint_hash" || k === "api_provider" ||
      k === "run_timestamp" || k === "method_class" || k === "paradigm" ||
      k === "corpus_license" || k === "corpus_attribution" ||
      k === "has_references"
    ) continue;
    if (!isFiniteOrNull(row[k])) {
      errors.push(`${k} must be a finite number or null`);
    }
  }

  // ---- entries -------------------------------------------------------------
  const rawEntries = body.entries;
  const entries: Record<string, unknown>[] = [];
  if (rawEntries !== undefined && rawEntries !== null) {
    if (!Array.isArray(rawEntries)) {
      errors.push("entries must be an array when present");
    } else if (rawEntries.length > MAX_ENTRIES) {
      errors.push(
        `entries: ${rawEntries.length} rows exceeds the cap of ${MAX_ENTRIES}`,
      );
    } else {
      for (let i = 0; i < rawEntries.length; i++) {
        const e = rawEntries[i];
        if (!isPlainObject(e)) {
          errors.push(`entries[${i}] must be an object`);
          continue;
        }
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(e)) {
          if (ALLOWED_ENTRY_COLUMNS.has(k)) clean[k] = v;
        }
        for (const tf of ENTRY_TEXT_FIELDS) {
          const v = clean[tf];
          if (typeof v === "string" && v.length > MAX_ENTRY_TEXT_CHARS) {
            errors.push(
              `entries[${i}].${tf} exceeds ${MAX_ENTRY_TEXT_CHARS} chars`,
            );
          }
        }
        entries.push(clean);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, row: null, entries: [] };
  }

  // ---- forced identity: the honesty rail -----------------------------------
  row.submitter = "anonymous";
  row.trust = "unverified";
  row.owner_uid = null;
  row.affirmation =
    `Results generated by mt-eval harness v${row.harness_version} ` +
    `and submitted via the anonymous public intake (submit-run).`;

  return { ok: true, errors: [], row, entries };
}

/** Bind sanitized entry rows to their run card id. */
export function bindEntries(
  entries: Record<string, unknown>[],
  cardId: string,
): Record<string, unknown>[] {
  return entries.map((e) => ({ run_card_id: cardId, ...e }));
}

// ---- rate limiting -----------------------------------------------------------

export interface RateDecision {
  allowed: boolean;
  /** Which cap tripped, for the 429 body. */
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

/** Salted SHA-256 of the client IP — the only form ever stored. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Is this a syntactically valid PUBLIC IP (v4 or v6)? Private, loopback,
 * link-local, CGNAT, and unspecified addresses — the ranges internal proxy
 * hops live in — return false, as does anything that isn't an IP at all. */
export function isPublicIp(ip: string): boolean {
  const s = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (!s) return false;
  const v4 = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const o = v4.slice(1).map(Number);
    if (o.some((x) => x > 255)) return false;
    if (o[0] === 0 || o[0] === 10 || o[0] === 127) return false; // this-net / RFC1918 / loopback
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return false; // CGNAT 100.64/10
    if (o[0] === 169 && o[1] === 254) return false; // link-local
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return false; // RFC1918
    if (o[0] === 192 && o[1] === 168) return false; // RFC1918
    return true;
  }
  if (s.includes(":") && /^[0-9a-f:.]{2,45}$/.test(s)) {
    if (s === "::" || s === "::1") return false; // unspecified / loopback
    if (s.startsWith("fc") || s.startsWith("fd")) return false; // ULA fc00::/7
    if (/^fe[89ab]/.test(s)) return false; // link-local fe80::/10
    const mapped = s.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) return isPublicIp(mapped[1]);
    return true;
  }
  return false;
}

/** Client IP for the rate-limit bucket — 2026-07-18 audit H2 fix, corrected
 * 2026-07-31 after the same defect was measured and fixed on the docent lane.
 *
 * cf-connecting-ip FIRST. PLATFORM NOTE (measured on Supabase Edge Functions,
 * 2026-07-26): requests arrive through Cloudflare and x-forwarded-for looks
 * like "<client>,<client>, 99.83.104.48" — the LAST hop is an AWS egress
 * address that ROTATES PER REQUEST, so keying on it (the original H2 rule
 * below) hands every request a fresh bucket and the per-IP hourly cap
 * silently never fires. cf-connecting-ip is set by Cloudflare and overwrites
 * any caller-supplied value, so it is both stable and unspoofable here.
 * See submit-ticket/lib.ts for the full measurement.
 *
 * The x-forwarded-for scan is kept as the fallback for non-Cloudflare
 * deployments, and it still reads RIGHT TO LEFT: never the leftmost hop,
 * which is client-supplied (any caller can prepend
 * `X-Forwarded-For: <fake>` to mint a fresh bucket per request). Remaining
 * fallbacks, in order: the raw connection peer (Deno.serve info.remoteAddr,
 * when the runtime exposes a public one), then the shared "unknown" bucket —
 * which fails CONTAINED (all headerless callers share one 5/hour window)
 * rather than open. */
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

/** Friendly 429 body — points at sign-in as the unlimited path. */
export function rateLimitMessage(reason: "ip_hourly" | "global_daily"): string {
  const which = reason === "ip_hourly"
    ? "This connection has reached the anonymous publishing limit " +
      "(a few cards per hour)."
    : "The anonymous intake has reached its daily community cap.";
  return which +
    " Your results are NOT lost — the harness keeps every report on disk. " +
    "Publish later with `mt-eval publish <report> --anonymous`, or sign in " +
    "(GitHub/Google — `mt-eval publish <report>`) for unlimited, attributed " +
    "publishing.";
}
