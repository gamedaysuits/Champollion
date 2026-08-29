/**
 * serve.js — self-hosted translation server engine (`champollion serve`).
 *
 * WHY THIS EXISTS:
 *   The hosted Champollion Translate API was shelved (founder decision,
 *   2026-07-19). What ships instead is the self-hosted path: any project
 *   owner can stand their OWN configured translation stack up behind the
 *   exact HTTP contract that lib/methods/api.js (the `api` method client)
 *   already speaks. One command on each side:
 *
 *     owner:    CHAMPOLLION_SERVE_TOKEN=... champollion serve
 *     consumer: champollion plugin install ./<manifest-dir> && champollion sync
 *
 * THE CONTRACT (mirror of lib/methods/api.js):
 *   POST /translate
 *     { source_locale, target_locale, method, keys: { key: sourceString } }
 *   → 200 { translations, meta: { model, cost_usd, quality_tier, ... } }
 *   → 207 { translations, errors: { key: { message } }, meta }   partial
 *   → 4xx/5xx { error: { code, message }, ... }                  structured
 *
 * NO FORKED TRANSLATION LOGIC:
 *   Requests run through the SAME pipeline `sync` uses — resolveRuntime for
 *   config/plugin/preflight resolution and translateAndValidate for the
 *   TM partition → API call → deterministic quality gate → TM store sequence.
 *   TM hits are served from cache at $0; gate failures come back as
 *   structured per-key errors, never as silently degraded output.
 *
 * SAFETY MODEL:
 *   - Bearer token required by default (CHAMPOLLION_SERVE_TOKEN / --token).
 *     Anonymous serving is allowed ONLY on a loopback bind (--no-auth).
 *   - Default bind is 127.0.0.1 — exposing the server is an explicit
 *     owner decision (--bind 0.0.0.0), because whoever can reach the port
 *     can spend the owner's upstream API budget.
 *   - Per-IP rate limit, request body size cap, per-request key cap.
 *   - Cost guard: --max-cost-per-request / --max-session-cost reuse the
 *     sync cost machinery (estimateCost + parseMaxCost). TM hits are free;
 *     an UNKNOWN estimate under a cap refuses the request (unknown ≠ free —
 *     same doctrine as `sync --max-cost`).
 *   - No request field is ever used as a filesystem path. Key names are
 *     screened with isUnsafeKey (prototype pollution) and a length cap.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { resolveConfig } from './config.js';
import { resolveRuntime } from './sync.js';
import { loadTM, saveTM, isTMDirty, partitionByTM, tmMethodKey } from './tm.js';
import { translateAndValidate } from './translate-pair.js';
import { estimateCost, QUALITY_TIERS } from './pairs.js';
import { getMethod } from './translate.js';
import { isUnsafeKey } from './security.js';
import { convertScript, applyScriptFallback } from './scripts.js';
import { verifyTerminology, logTermViolations } from './terminology.js';
import { validateManifest } from './plugins.js';
import { output } from './output.js';

const require = createRequire(import.meta.url);
const CLI_VERSION = require('../package.json').version;

/**
 * Server defaults — exported so the command bridge, help text, and tests
 * reference one source of truth instead of re-declaring numbers.
 *
 * Port 1822: the year Champollion deciphered the Rosetta hieroglyphs.
 */
const SERVE_DEFAULTS = {
  port: 1822,
  bind: '127.0.0.1',
  rateLimitPerMin: 120,     // per client IP, /translate only; 0 disables
  maxBodyBytes: 1_000_000,  // 1 MB — the api.js client chunks at 100 keys/request
  maxKeysPerRequest: 500,   // hard per-request key cap (client sends ≤ 100)
  minTokenLength: 12,       // shorter tokens are brute-forceable even rate-limited
};

// Longest key NAME accepted in a request. Values are bounded by the body
// size cap; names this long are never legitimate dot-notation i18n keys.
const MAX_KEY_NAME_LENGTH = 300;

// -----------------------------------------------------------------
// Runtime resolution — the owner's configured stack
// -----------------------------------------------------------------

/**
 * Resolve the owner's translation runtime for serving.
 *
 * Same sequence as `sync`: resolveConfig (config file + CLI overrides) →
 * resolveRuntime (languages, pair graph, plugin merge, preflight). With
 * preflight on, a stack that cannot execute (missing upstream key, …)
 * fails HERE at startup — no gas, no ignition — instead of per-request.
 *
 * @param {object} options
 * @param {string} options.cwd - Owner project root
 * @param {object} [options.cliArgs] - Parsed CLI args (--method/--model/--pair/… work like sync)
 * @param {boolean} [options.preflight=true] - Run method readiness checks
 * @returns {Promise<{ config, apiKey, resolvedPairs, pairEntries, tm, cwd }>}
 */
async function createServeRuntime({ cwd, cliArgs = {}, preflight = true }) {
  const config = resolveConfig(cliArgs, cwd);
  // resolveRuntime skips preflight when cliArgs.dryRun is set (read-only
  // paths don't need an API key) — manifest emission reuses that lane.
  const runtimeArgs = preflight ? { ...cliArgs } : { ...cliArgs, dryRun: true };
  const { apiKey, resolvedPairs, pairEntries } = await resolveRuntime(config, cwd, runtimeArgs);

  if (pairEntries.length === 0) {
    throw new Error(
      'No translation pairs configured — nothing to serve. ' +
      'Add "languages" or "pairs" to champollion.config.json (or run `champollion init`).'
    );
  }

  const tm = loadTM(cwd);
  return { config, apiKey, resolvedPairs, pairEntries, tm, cwd };
}

/**
 * Derive a kebab-case served-method name from the owner project directory.
 * Falls back to 'champollion-serve' when the basename sanitizes to nothing.
 *
 * @param {string} cwd - Owner project root
 * @returns {string} e.g. "my-project-serve"
 */
function deriveMethodName(cwd) {
  const base = path.basename(path.resolve(cwd))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return base ? `${base}-serve` : 'champollion-serve';
}

/**
 * Most conservative quality tier across the served pairs.
 *
 * The manifest carries ONE qualityTier; when pairs differ, advertising the
 * highest would overstate the weakest pair. Order comes from QUALITY_TIERS
 * (standard < high < research < verified).
 *
 * @param {Array<[string, object]>} pairEntries
 * @returns {string}
 */
function minQualityTier(pairEntries) {
  const order = Object.keys(QUALITY_TIERS);
  let min = order.length - 1;
  for (const [, pairConfig] of pairEntries) {
    const idx = order.indexOf(pairConfig.qualityTier || 'standard');
    min = Math.min(min, idx === -1 ? 0 : idx);
  }
  return order[Math.max(min, 0)];
}

// -----------------------------------------------------------------
// Manifest emission (--emit-manifest)
// -----------------------------------------------------------------

/**
 * Resolve the consumer-facing endpoint URL for the manifest.
 *
 * @param {string|null} rawEndpoint - --endpoint value (public URL), or null
 * @param {number} port - Serve port (for the loopback default)
 * @returns {string} Absolute http(s) URL ending in a translate path
 */
function resolveManifestEndpoint(rawEndpoint, port) {
  if (!rawEndpoint) {
    return `http://127.0.0.1:${port}/translate`;
  }
  let url;
  try {
    url = new URL(String(rawEndpoint));
  } catch {
    throw new Error(`--endpoint must be an absolute http(s) URL (got "${rawEndpoint}").`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`--endpoint must use http or https (got "${url.protocol}//").`);
  }
  // A bare origin gets the standard path appended; an explicit path is
  // respected verbatim (owners may mount behind a proxy at any path).
  if (url.pathname === '/' || url.pathname === '') {
    url.pathname = '/translate';
  }
  return url.href;
}

/**
 * Build the method.json plugin manifest a CONSUMER installs to point
 * `method: "api"` at this server (see docs/reference/plugin-spec).
 *
 * Honesty rules:
 *   - qualityTier is a PASSTHROUGH of the served pairs' own tiers (most
 *     conservative when they differ) — never invented.
 *   - provenance is merged from the underlying methods' own declarations:
 *     commercialReady only when EVERY pair's method is cleared; flags union.
 *   - The manifest is validated against the plugin contract before return,
 *     so an emitted file always installs.
 *
 * @param {object} runtime - From createServeRuntime
 * @param {object} options
 * @param {string} options.name - Served method name (kebab-case)
 * @param {string} options.endpointUrl - Consumer-reachable endpoint URL
 * @returns {object} Validated manifest object
 */
function buildServeManifest(runtime, { name, endpointUrl }) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error(`Served method name must be kebab-case (got "${name}"). Use --name to override.`);
  }

  const { pairEntries, cwd } = runtime;
  const locales = [...new Set(pairEntries.map(([, p]) => p.target))];
  const methodSummary = [...new Set(pairEntries.map(([, p]) => p.method || 'llm'))].join(', ');

  // Owner project version when it is plugin-grade semver, else 0.1.0.
  let version = '0.1.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    if (typeof pkg.version === 'string' && /^\d+\.\d+\.\d+/.test(pkg.version)) {
      version = pkg.version;
    }
  } catch {
    // No package.json — the default stands.
  }

  // Merge provenance from the actual method implementations behind the server.
  const resources = [];
  const seenResources = new Set();
  let commercialReady = true;
  const flags = new Set();
  for (const [, pairConfig] of pairEntries) {
    let prov;
    try {
      prov = getMethod(pairConfig.method || 'llm', pairConfig).getProvenance();
    } catch {
      continue;
    }
    for (const res of prov?.resources || []) {
      const key = `${res.name}|${res.license}`;
      if (!seenResources.has(key)) {
        seenResources.add(key);
        resources.push(res);
      }
    }
    if (prov && prov.commercialReady !== true) commercialReady = false;
    for (const f of prov?.flags || []) flags.add(f);
  }

  const manifest = {
    name,
    type: 'api',
    version,
    description:
      `Self-hosted champollion serve endpoint (${methodSummary}) for ${locales.join(', ')}. ` +
      'Translations run on the owner\'s own stack; this manifest only points the api method at it.',
    endpoint: endpointUrl,
    locales,
    // For an api-type plugin, model/register/batchSize/temperature live
    // SERVER-side and are OMITTED (the plugin schema does not allow null
    // for them); the nullable coaching/context fields ship as explicit
    // nulls per the canonical MethodConfig shape. qualityTier is the only
    // consumer-relevant value: an honest passthrough of the served stack.
    config: {
      coachingFile: null,
      coachingPrompt: null,
      promptContext: null,
      qualityTier: minQualityTier(pairEntries),
    },
    provenance: {
      resources,
      commercialReady,
      flags: [...flags],
    },
    _emittedBy: `champollion-serve/${CLI_VERSION} (champollion serve --emit-manifest)`,
  };

  const validation = validateManifest(manifest);
  if (!validation.valid) {
    // Should be unreachable — the emitter must never produce an uninstallable
    // manifest. Fail loud rather than write a broken file.
    throw new Error(`Emitted manifest failed plugin validation: ${validation.errors.join(', ')}`);
  }
  return manifest;
}

// -----------------------------------------------------------------
// HTTP plumbing — rate limit, auth, body reading
// -----------------------------------------------------------------

/**
 * Sliding-window per-IP rate limiter (timestamps within the last 60s).
 * Client IP is the SOCKET address — X-Forwarded-For is never trusted
 * (trivially spoofable by any direct client).
 */
class RateLimiter {
  constructor(limitPerMin) {
    this.limit = limitPerMin;
    this.windowMs = 60_000;
    this.hits = new Map(); // ip → number[] (ms timestamps)
    // Periodic sweep so idle IPs don't accumulate; unref'd so the timer
    // never holds the process open.
    if (this.limit > 0) {
      this._sweep = setInterval(() => this._prune(Date.now()), this.windowMs);
      this._sweep.unref();
    }
  }

  _prune(now) {
    for (const [ip, stamps] of this.hits) {
      const live = stamps.filter(t => now - t < this.windowMs);
      if (live.length === 0) this.hits.delete(ip);
      else this.hits.set(ip, live);
    }
  }

  /**
   * @param {string} ip
   * @returns {{ allowed: boolean, retryAfterSec?: number }}
   */
  check(ip) {
    if (this.limit <= 0) return { allowed: true };
    const now = Date.now();
    const stamps = (this.hits.get(ip) || []).filter(t => now - t < this.windowMs);
    if (stamps.length >= this.limit) {
      const retryAfterSec = Math.max(1, Math.ceil((stamps[0] + this.windowMs - now) / 1000));
      this.hits.set(ip, stamps);
      return { allowed: false, retryAfterSec };
    }
    stamps.push(now);
    this.hits.set(ip, stamps);
    return { allowed: true };
  }

  stop() {
    if (this._sweep) clearInterval(this._sweep);
  }
}

/**
 * Constant-time bearer-token comparison (hash both sides so length never
 * leaks through timingSafeEqual's equal-length requirement).
 */
function tokenMatches(supplied, expected) {
  const a = crypto.createHash('sha256').update(String(supplied)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Loopback binds are the only ones allowed to run without auth. */
function isLoopbackBind(bind) {
  return bind === '127.0.0.1' || bind === '::1' || bind === 'localhost';
}

/**
 * Read a request body with a hard size cap.
 *
 * @returns {Promise<Buffer>} Rejects with { statusCode: 413 } when over cap
 */
function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      if (rejected) return; // over cap: keep draining so the 413 can flush
      size += chunk.length;
      if (size > maxBytes) {
        rejected = true;
        chunks.length = 0;
        const err = new Error(`Request body exceeds the ${maxBytes} byte cap`);
        err.statusCode = 413;
        // Do NOT destroy the socket here — the structured 413 still has to
        // reach the client. The handler responds with Connection: close.
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!rejected) resolve(Buffer.concat(chunks)); });
    req.on('error', (err) => { if (!rejected) reject(err); });
  });
}

function sendJSON(res, status, body, extraHeaders = {}) {
  // The socket may already be gone (client abort, over-cap upload) —
  // a failed error-response write must never crash the server.
  try {
    if (res.writableEnded || res.destroyed) return;
    res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
    res.end(JSON.stringify(body));
  } catch {
    /* response socket unusable — nothing left to say */
  }
}

function sendError(res, status, code, message, extra = {}, extraHeaders = {}) {
  sendJSON(res, status, { error: { code, message }, ...extra }, extraHeaders);
}

// -----------------------------------------------------------------
// The /translate handler
// -----------------------------------------------------------------

/**
 * Screen the raw `keys` payload from a request.
 *
 * Request data must never reach the pipeline unvetted: unsafe key names
 * (prototype pollution), non-string values, and absurd key names are
 * rejected PER KEY so one bad entry doesn't sink an honest batch.
 *
 * @param {object} rawKeys - Parsed request `keys` object
 * @returns {{ payload: object, keyNames: string[], rejected: object }}
 */
function screenRequestKeys(rawKeys) {
  // Null-prototype containers: indexing a PLAIN object with a key named
  // "__proto__" hits Object.prototype's setter instead of creating a
  // property — the very record of rejecting "__proto__" would silently
  // vanish (and swap the container's prototype). JSON.parse creates such
  // keys as own properties, so hostile bodies genuinely reach this point.
  const payload = Object.create(null);
  const keyNames = [];
  const rejected = Object.create(null);
  for (const key of Object.keys(rawKeys)) {
    const value = rawKeys[key];
    if (key.length > MAX_KEY_NAME_LENGTH) {
      rejected[key.slice(0, 80) + '…'] = { message: `key name exceeds ${MAX_KEY_NAME_LENGTH} characters` };
      continue;
    }
    if (isUnsafeKey(key)) {
      rejected[key] = { message: 'unsafe key name (reserved object property)' };
      continue;
    }
    if (typeof value !== 'string' || value.length === 0) {
      rejected[key] = { message: 'value must be a non-empty string' };
      continue;
    }
    payload[key] = value;
    keyNames.push(key);
  }
  return { payload, keyNames, rejected };
}

/**
 * Handle one POST /translate request through the owner's real pipeline.
 *
 * @param {object} ctx - Server context (runtime, caps, session ledger)
 * @param {object} body - Parsed request body
 * @param {http.ServerResponse} res
 */
async function handleTranslate(ctx, body, res) {
  const { runtime, methodName, maxCostPerRequest, maxSessionCost, session } = ctx;
  const startedAt = Date.now();

  const sourceLocale = body.source_locale;
  const targetLocale = body.target_locale;
  if (typeof sourceLocale !== 'string' || sourceLocale.length === 0
    || typeof targetLocale !== 'string' || targetLocale.length === 0) {
    return sendError(res, 400, 'invalid_request', 'source_locale and target_locale are required strings.');
  }

  // Method routing: this server serves exactly ONE named method (plus the
  // client default). Anything else is honestly "not found" — the consumer
  // is pointed at the wrong server or an outdated manifest.
  const requestedMethod = body.method == null ? 'default' : String(body.method);
  if (requestedMethod !== 'default' && requestedMethod !== methodName) {
    return sendError(res, 404, 'method_not_found',
      `Method "${requestedMethod}" is not served here. This server serves "${methodName}" (or "default").`);
  }

  if (body.keys == null || typeof body.keys !== 'object' || Array.isArray(body.keys)) {
    return sendError(res, 400, 'invalid_request', '"keys" must be an object of { key: sourceString }.');
  }
  const requestedCount = Object.keys(body.keys).length;
  if (requestedCount === 0) {
    return sendError(res, 400, 'invalid_request', '"keys" must contain at least one entry.');
  }
  if (requestedCount > ctx.maxKeysPerRequest) {
    return sendError(res, 400, 'too_many_keys',
      `Request has ${requestedCount} keys; this server accepts at most ${ctx.maxKeysPerRequest} per request.`);
  }

  const { payload, keyNames, rejected } = screenRequestKeys(body.keys);
  if (keyNames.length === 0) {
    return sendError(res, 400, 'no_translatable_keys',
      'No key in the request survived screening (values must be non-empty strings; reserved key names are refused).',
      { errors: rejected });
  }

  // Pair lookup — the request only selects among pairs the OWNER configured.
  // Locale strings are used as Map keys only, never as filesystem paths.
  const pairKey = `${sourceLocale}:${targetLocale}`;
  const pairConfig = runtime.resolvedPairs.get(pairKey);
  if (!pairConfig) {
    const supported = [...runtime.resolvedPairs.keys()].sort().join(', ');
    return sendError(res, 400, 'unsupported_pair',
      `Pair "${pairKey}" is not configured on this server. Served pairs: ${supported}.`);
  }

  // ── Cost guard (reuses the sync cost machinery) ─────────────────────
  // TM hits are $0 by construction, so the gate prices only the misses.
  // Unknown estimates under a cap refuse the request: unknown ≠ free.
  const tmKey = tmMethodKey(pairConfig);
  const { misses } = partitionByTM(runtime.tm, payload, keyNames, targetLocale, tmKey);
  let estimate = null;
  if (misses.length > 0) {
    estimate = await estimateCost(misses.length, pairConfig);
    const estimated = estimate?.estimatedCost ?? null;

    if (maxCostPerRequest !== null || maxSessionCost !== null) {
      if (estimated === null) {
        return sendError(res, 402, 'cost_unknown',
          `This server enforces a cost cap, but method "${pairConfig.method}" has unknown pricing for ` +
          `${misses.length} uncached key(s) — refusing (unknown is not free).`);
      }
      if (maxCostPerRequest !== null && estimated > maxCostPerRequest) {
        return sendError(res, 402, 'cost_cap_exceeded',
          `Estimated request cost $${estimated.toFixed(4)} exceeds the per-request cap $${maxCostPerRequest.toFixed(4)}.`,
          { estimated_cost_usd: estimated, max_cost_per_request_usd: maxCostPerRequest });
      }
      if (maxSessionCost !== null && session.spendUsd + estimated > maxSessionCost) {
        return sendError(res, 402, 'session_ceiling_exceeded',
          `Estimated request cost $${estimated.toFixed(4)} would push session spend past the ` +
          `$${maxSessionCost.toFixed(4)} ceiling (spent so far: ~$${session.spendUsd.toFixed(4)}). Restart the server to reset.`,
          { estimated_cost_usd: estimated, session_spend_usd: session.spendUsd, session_ceiling_usd: maxSessionCost });
      }
    }
  }

  // ── The real pipeline: TM partition → API → quality gate → TM store ──
  let result;
  try {
    result = await translateAndValidate(keyNames, payload, pairConfig, pairKey, {
      apiKey: runtime.apiKey,
      tm: runtime.tm,
      targetCode: targetLocale,
      onProgress: null,
    });
  } catch (err) {
    output.error(`[serve] ${pairKey}: pipeline error — ${err.message}`);
    return sendError(res, 500, 'internal_error', 'Translation pipeline failed. See server logs.');
  }
  if (result.apiCalled) output.progress(' done\n');

  // Session ledger: count the estimate for any request that actually hit
  // the upstream API (conservative — estimates deliberately err high).
  if (result.apiCalled && estimate?.estimatedCost != null) {
    session.spendUsd += estimate.estimatedCost;
  }

  // Persist TM mutations (stores AND evictions) after every request so a
  // crash never loses paid, gate-validated translations. Atomic write.
  if (isTMDirty(runtime.tm)) {
    try {
      saveTM(runtime.cwd, runtime.tm);
    } catch (err) {
      output.warn(`[serve] TM save failed: ${err.message}`);
    }
  }

  // Upstream produced nothing at all → the server has nothing honest to
  // return. 5xx so the api.js client retries (transient upstream trouble).
  if (!result.translated && result.apiReturnedNull && result.failures.length === 0) {
    return sendError(res, 502, 'upstream_failed',
      `Translation method "${pairConfig.method}" returned no results for ${pairKey}.`);
  }

  const translations = {};
  let keptWorkingScript = 0;
  if (result.translated) {
    // Script conversion only when the pair's resolution asked for it — same
    // rule as sync (see lib/scripts.js resolveTargetScript). On unmapped
    // letters the whole value stays in the working script rather than mixing
    // scripts, and the response meta says so.
    const scriptConverterKey = pairConfig.scriptResolution?.converterKey || null;
    for (const [key, value] of Object.entries(result.translated)) {
      if (scriptConverterKey && typeof value === 'string') {
        const prepared = applyScriptFallback(value, pairConfig.scriptFallback);
        const { converted, unmapped } = convertScript(prepared, scriptConverterKey);
        if (unmapped.length === 0) {
          translations[key] = converted;
        } else {
          translations[key] = value;
          keptWorkingScript++;
          output.warn(`[serve] ${pairKey}: key "${key}" kept in working script — unmapped letter(s): ${unmapped.join(', ')}`);
        }
      } else {
        translations[key] = value;
      }
    }
    // Terminology enforcement is advisory, same as sync: log, don't reject.
    if (pairConfig.coachingData?.dictionary) {
      const { violations } = verifyTerminology(result.translated, payload, pairConfig.coachingData.dictionary);
      if (violations.length > 0) logTermViolations(violations, pairKey);
    }
  }

  // Per-key errors: screening rejections + quality-gate failures. A key that
  // failed the gate (after the one feedback retry) is REPORTED, never
  // replaced with degraded output. (Spread copies own properties — including
  // a rejected "__proto__" — as data properties; only assignment is unsafe.)
  const errors = { ...rejected };
  for (const f of result.failures) {
    errors[f.key] = { message: `quality gate: ${f.reason}` };
  }

  const translatedCount = Object.keys(translations).length;
  const errorCount = Object.keys(errors).length;

  // Honest cost meta: fully-TM-served requests are a KNOWN $0; API misses
  // carry the pre-run estimate (upper bound), never a fabricated actual.
  let costUsd = null;
  let costBasis = 'unknown';
  if (misses.length === 0) {
    costUsd = 0;
    costBasis = 'tm-cache';
  } else if (estimate?.estimatedCost != null) {
    costUsd = estimate.estimatedCost;
    costBasis = 'estimate';
  }

  const meta = {
    served_by: `champollion-serve/${CLI_VERSION}`,
    method: methodName,
    method_type: pairConfig.method || 'llm',
    model: pairConfig.model || null,
    quality_tier: pairConfig.qualityTier || 'standard',
    source_locale: sourceLocale,
    target_locale: targetLocale,
    requested: requestedCount,
    translated: translatedCount,
    failed: errorCount,
    tm_hits: result.tmHitCount,
    // Script conversion status for this pair: which script was written and
    // how many values stayed in the working script (unmapped letters).
    script_conversion: {
      script: pairConfig.scriptResolution?.script ?? null,
      converts: !!pairConfig.scriptResolution?.converterKey,
      kept_working_script: keptWorkingScript,
    },
    cost_usd: costUsd,
    cost_basis: costBasis,
    ...(maxSessionCost !== null && {
      session_spend_usd: session.spendUsd,
      session_ceiling_usd: maxSessionCost,
    }),
  };

  let status;
  let responseBody;
  if (translatedCount === 0) {
    // Everything failed the quality gate — a structured refusal, not output.
    status = 422;
    responseBody = {
      error: {
        code: 'quality_gate_failed',
        message: `All ${errorCount} key(s) were rejected by the deterministic quality gate.`,
      },
      errors,
      meta,
    };
  } else if (errorCount > 0) {
    status = 207; // partial success — api.js logs per-key warnings and keeps the rest
    responseBody = { translations, errors, meta };
  } else {
    status = 200;
    responseBody = { translations, meta };
  }

  session.requests += 1;
  output.info(
    `[serve] ${pairKey} ${requestedCount} key(s) → ${status} in ${Date.now() - startedAt}ms ` +
    `(tm ${result.tmHitCount}, api ${misses.length}, failed ${errorCount})`
  );
  return sendJSON(res, status, responseBody);
}

// -----------------------------------------------------------------
// Server lifecycle
// -----------------------------------------------------------------

/**
 * Start the serve HTTP server.
 *
 * @param {object} options
 * @param {string} options.cwd - Owner project root
 * @param {object} [options.cliArgs] - CLI args forwarded to config resolution
 * @param {object} [options.runtime] - Pre-built runtime (tests); built from cwd otherwise
 * @param {string} [options.bind] - Bind address (default 127.0.0.1)
 * @param {number} [options.port] - Port (default 1822; 0 = ephemeral)
 * @param {string|null} [options.token] - Bearer token (required unless noAuth on loopback)
 * @param {boolean} [options.noAuth] - Disable auth — loopback binds only
 * @param {number} [options.rateLimitPerMin] - Per-IP /translate limit (0 disables)
 * @param {number} [options.maxBodyBytes] - Request body cap
 * @param {number} [options.maxKeysPerRequest] - Per-request key cap
 * @param {number|null} [options.maxCostPerRequest] - USD cap per request
 * @param {number|null} [options.maxSessionCost] - USD ceiling across the process lifetime
 * @param {string} [options.methodName] - Served method name (manifest name)
 * @returns {Promise<{ server, port, url, session, runtime, close }>}
 */
async function startServeServer(options) {
  const {
    cwd,
    cliArgs = {},
    bind = SERVE_DEFAULTS.bind,
    port = SERVE_DEFAULTS.port,
    token = null,
    noAuth = false,
    rateLimitPerMin = SERVE_DEFAULTS.rateLimitPerMin,
    maxBodyBytes = SERVE_DEFAULTS.maxBodyBytes,
    maxKeysPerRequest = SERVE_DEFAULTS.maxKeysPerRequest,
    maxCostPerRequest = null,
    maxSessionCost = null,
  } = options;

  // ── Auth invariants — enforced in the ENGINE so no caller can skip them ──
  if (noAuth && !isLoopbackBind(bind)) {
    throw new Error(
      `--no-auth is only allowed on a loopback bind (127.0.0.1 / ::1 / localhost), got --bind ${bind}. ` +
      'An unauthenticated server on a reachable interface lets anyone spend your upstream API budget.'
    );
  }
  if (!noAuth && !token) {
    throw new Error(
      'Refusing to start without a bearer token. Set CHAMPOLLION_SERVE_TOKEN (env or .env.local), ' +
      'pass --token <secret>, or opt out explicitly with --no-auth --bind 127.0.0.1 (loopback only).'
    );
  }
  if (!noAuth && token.length < SERVE_DEFAULTS.minTokenLength) {
    throw new Error(
      `Bearer token must be at least ${SERVE_DEFAULTS.minTokenLength} characters — short tokens are ` +
      'brute-forceable even behind the rate limit. Try: openssl rand -hex 24'
    );
  }

  const runtime = options.runtime || await createServeRuntime({ cwd, cliArgs });
  const methodName = options.methodName || deriveMethodName(cwd);
  const limiter = new RateLimiter(rateLimitPerMin);
  const session = { spendUsd: 0, requests: 0, startedAt: new Date().toISOString() };

  const ctx = {
    runtime,
    methodName,
    maxKeysPerRequest,
    maxCostPerRequest,
    maxSessionCost,
    session,
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://placeholder.invalid');

      // Health probe: unauthenticated, minimal, does no translation work.
      if (req.method === 'GET' && url.pathname === '/health') {
        return sendJSON(res, 200, { ok: true, service: 'champollion-serve', version: CLI_VERSION });
      }

      if (url.pathname !== '/translate') {
        return sendError(res, 404, 'not_found', `No route for ${req.method} ${url.pathname}. POST /translate is the contract endpoint.`);
      }
      if (req.method !== 'POST') {
        return sendError(res, 405, 'method_not_allowed', 'Use POST /translate.', {}, { Allow: 'POST' });
      }

      // Rate limit BEFORE auth so token guessing is throttled too.
      // Socket address only — X-Forwarded-For is client-controlled.
      const ip = req.socket.remoteAddress || 'unknown';
      const rate = limiter.check(ip);
      if (!rate.allowed) {
        return sendError(res, 429, 'rate_limited',
          `Rate limit of ${rateLimitPerMin} requests/minute per IP exceeded.`,
          {}, { 'Retry-After': String(rate.retryAfterSec) });
      }

      if (!noAuth) {
        const header = req.headers['authorization'] || '';
        const match = /^Bearer\s+(.+)$/.exec(header);
        if (!match || !tokenMatches(match[1].trim(), token)) {
          return sendError(res, 401, 'unauthorized',
            'Missing or invalid bearer token. Send "Authorization: Bearer <token>" ' +
            '(the CHAMPOLLION_API_KEY on the consumer side).');
        }
      }

      let raw;
      try {
        raw = await readBody(req, maxBodyBytes);
      } catch (err) {
        if (err.statusCode === 413) {
          // Connection: close ends the socket after the response flushes,
          // so the client's remaining upload is discarded, not read.
          return sendError(res, 413, 'payload_too_large', err.message, {}, { Connection: 'close' });
        }
        throw err;
      }

      let body;
      try {
        body = JSON.parse(raw.toString('utf-8'));
      } catch {
        return sendError(res, 400, 'invalid_json', 'Request body is not valid JSON.');
      }
      if (body == null || typeof body !== 'object' || Array.isArray(body)) {
        return sendError(res, 400, 'invalid_request', 'Request body must be a JSON object.');
      }

      await handleTranslate(ctx, body, res);
    } catch (err) {
      output.error(`[serve] request error: ${err.message}`);
      sendError(res, 500, 'internal_error', 'Internal server error. See server logs.');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, bind, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const actualPort = server.address().port;

  const close = () => new Promise((resolve) => {
    limiter.stop();
    // Persist any TM entries a final in-flight request stored.
    if (isTMDirty(runtime.tm)) {
      try { saveTM(runtime.cwd, runtime.tm); } catch { /* best effort on shutdown */ }
    }
    server.closeAllConnections?.();
    server.close(() => resolve());
  });

  return {
    server,
    port: actualPort,
    url: `http://${isLoopbackBind(bind) ? '127.0.0.1' : bind}:${actualPort}/translate`,
    session,
    runtime,
    methodName,
    close,
  };
}

export {
  SERVE_DEFAULTS,
  createServeRuntime,
  deriveMethodName,
  minQualityTier,
  resolveManifestEndpoint,
  buildServeManifest,
  startServeServer,
  screenRequestKeys,
  isLoopbackBind,
};
