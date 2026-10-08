/**
 * API Translation Method — thin HTTP client for remote translation endpoints.
 *
 * This method contains ZERO translation logic. It is purely a transport layer
 * that delegates translation to a remote server. All prompts, coaching data,
 * grammar rules, and linguistic pipelines live server-side.
 *
 * HOW IT WORKS:
 *   1. Reads the endpoint URL from the plugin manifest
 *   2. Reads API key from CHAMPOLLION_API_KEY env var
 *   3. POSTs keys to the endpoint per the champollion API contract
 *   4. Receives translations + billing metadata
 *   5. Returns the key-value map to the sync pipeline
 *
 * WHY THIS IS A DUMB PIPE:
 *   The entire point of the API method is IP protection. The prompts,
 *   coaching data, and evaluation techniques stay on the server. This
 *   method ships in the open-source npm package and must contain nothing
 *   proprietary. It sends keys out, gets translations back. That's it.
 *
 * REQUEST FORMAT (what champollion sends):
 *   {
 *     source_locale: "en",
 *     target_locale: "crk",
 *     method: "crk-coached-v1",
 *     keys: { "hero.title": "Welcome", ... },
 *     instructions: { "hero.title": "…" }   // only when the endpoint declares
 *                                          // "acceptsInstructions": true
 *   }
 *
 * RESPONSE FORMAT (what the API returns):
 *   {
 *     translations: { "hero.title": "tawâw...", ... },
 *     meta: { model, cost_usd, quality_tier, ... }
 *   }
 *
 * CONTENT (Markdown bodies) uses the SAME contract: the body pieces go out as
 * keys ("segment.<N>" per block in block mode, "body" in page mode) with the
 * optional field  text_format: "markdown"  so a server can tell document text
 * from app strings (servers that do not know the field ignore it). Only the
 * Markdown leaves — never the LLM instruction prompt the CLI wraps it in.
 *
 * COST PROFILE: Varies by method — determined server-side
 * QUALITY TIER: Varies by method — read from plugin manifest
 */

import { TranslationMethod } from './base.js';
import {
  MAX_RETRIES, REQUEST_TIMEOUT_MS,
  getBackoffDelay, sleep,
} from './http-utils.js';
import { pMap } from '../concurrent.js';
import { DEFAULT_METHOD_CONCURRENCY } from '../config.js';
import { output } from '../output.js';
import { SEGMENT_MARKER_PREFIX, SEGMENT_MARKER_SUFFIX } from '../segment.js';
import { parseContentPrompt } from './content-separator.js';
import { getEnvOrFileVar } from '../api-key.js';
import { isLoopbackEndpoint, localMachineCost } from './http-utils.js';
import { captureRequest, isCapturing, PREVIEW_KEY } from './request-capture.js';

// Maximum keys per API request (server-side limit)
const MAX_KEYS_PER_REQUEST = 100;

// The block/page parser lives in content-separator.js (shared with the
// raw-text engines); api sends the blocks as keys.
const contentRequest = parseContentPrompt;

class APIMethod extends TranslationMethod {
  constructor(options = {}) {
    super('api', options);

    // These come from the plugin manifest, set by the orchestrator
    this.endpoint = options.endpoint || null;
    this.methodName = options.methodName || null;
    this.methodVersion = options.methodVersion || null;
    this.qualityTier = options.qualityTier || 'standard';
    this.pluginProvenance = options.provenance || null;
    // Per-key instructions (plural forms, a quality-gate retry's feedback)
    // reach the endpoint only when it declares it follows them
    // ("acceptsInstructions": true on the pair or in the plugin manifest) —
    // they travel as an "instructions" object beside "keys". false (a trained
    // NMT model, e.g. nmt-forge serve) and unknown send the text alone.
    this.declaredInstructions = typeof options.acceptsInstructions === 'boolean' ? options.acceptsInstructions : null;
    this.acceptsKeyInstructions = this.declaredInstructions === true;
    this.supportsRequestPreview = true; // its transport reports to request-capture.js
  }

  /**
   * Translate a batch of key-value pairs via a remote API.
   *
   * @param {string[]} keys - Flat dot-notation keys to translate
   * @param {object} sourceFlat - Full flattened source locale
   * @param {object} pairConfig - Pair config (target, source, endpoint, etc.)
   * @param {object} options - { apiKey } or reads from env
   * @returns {object|null} Map of key → translated value, or null
   */
  async translate(keys, sourceFlat, pairConfig, options) {
    const endpointForKey = this.endpoint || pairConfig.endpoint || options.endpoint;
    // A request preview needs no key: it is shown, never sent.
    const apiKey = resolveApiMethodKey(pairConfig, endpointForKey, options.cwd) || (isCapturing() ? PREVIEW_KEY : null);

    if (!apiKey) {
      output.error(`API method: no key for ${endpointForKey || 'this endpoint'}.`);
      output.error('Set CHAMPOLLION_API_KEY, or "apiKey": "${YOUR_VAR}" on the pair.');
      return null;
    }

    // Endpoint comes from the plugin manifest or the pair config
    const endpoint = this.endpoint
      || pairConfig.endpoint
      || options.endpoint;

    if (!endpoint) {
      output.error('API method: No endpoint configured.');
      output.error('Install a plugin: champollion plugin install <method-name>');
      return null;
    }

    const sourceLocale = pairConfig.source || 'en';
    const targetLocale = pairConfig.target;
    const method = this.methodName || pairConfig.methodPlugin || 'default';
    // 'markdown' for content-body pieces (translateContent below); unset for
    // app strings, so key-value requests are unchanged.
    const textFormat = options.textFormat || null;

    const allTranslated = {};

    const batchChunks = [];
    for (let i = 0; i < keys.length; i += MAX_KEYS_PER_REQUEST) {
      batchChunks.push(keys.slice(i, i + MAX_KEYS_PER_REQUEST));
    }

    await pMap(batchChunks, async (chunk, idx) => {
      // Build the key-value payload for this batch
      const keysPayload = {};
      for (const key of chunk) {
        const value = sourceFlat[key];
        if (value && typeof value === 'string') {
          keysPayload[key] = value;
        }
      }

      if (Object.keys(keysPayload).length === 0) return;

      // Declared instruction-following endpoints get the per-key notes.
      let instructions = null;
      if (this.acceptsKeyInstructions && options.descriptions) {
        for (const key of Object.keys(keysPayload)) {
          if (typeof options.descriptions[key] === 'string' && options.descriptions[key]) {
            instructions = instructions || {};
            instructions[key] = options.descriptions[key];
          }
        }
      }

      const result = await this._translateBatchWithRetry(
        keysPayload,
        sourceLocale,
        targetLocale,
        method,
        endpoint,
        apiKey,
        idx + 1,
        textFormat,
        instructions,
      );

      if (result) {
        Object.assign(allTranslated, result);
      }
    }, { concurrency: DEFAULT_METHOD_CONCURRENCY });

    return Object.keys(allTranslated).length > 0 ? allTranslated : null;
  }

  /**
   * Content (Markdown body) translation via the API.
   *
   * The content lane passes the prompt it built for an LLM (see
   * contentRequest above). The Markdown inside it is sent over the same
   * key → string contract with text_format "markdown", and the answer is
   * rebuilt in the shape the content lane parses: one ⟦SEG_N⟧ marker per
   * block (a block the server did not return is LEFT OUT, so the lane's
   * self-repair ladder retries it and then marks it '[EN]' — visible, never
   * silent), or the translated body in page mode.
   *
   * (This used to return null unconditionally "so the orchestrator falls
   * back to the local LLM method" — no such fallback exists: every content
   * file failed with "block-batch translation returned no results" and no
   * reason. Synthetic users, 2026-10.)
   */
  async translateContent(prompt, pairConfig, options = {}) {
    const request = contentRequest(prompt);
    if (!request) {
      output.error('API method: this content prompt carries neither ⟦SEG_N⟧ blocks nor a "---" body separator — nothing to send.');
      return null;
    }
    const names = Object.keys(request.keys).filter((k) => request.keys[k].trim());
    if (names.length === 0) return null;
    const result = await this.translate(names, request.keys, pairConfig,
      { ...options, textFormat: 'markdown' });
    if (!result) return null;
    if (request.mode === 'page') {
      return typeof result.body === 'string' ? result.body : null;
    }
    const parts = request.ids
      .filter((id) => typeof result[`segment.${id}`] === 'string')
      .map((id) => `${SEGMENT_MARKER_PREFIX}${id}${SEGMENT_MARKER_SUFFIX}\n${result[`segment.${id}`]}`);
    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  /**
   * POST to the remote API with exponential backoff retry.
   *
   * @param {object} keysPayload - Map of key → source value
   * @param {string} sourceLocale - Source language code
   * @param {string} targetLocale - Target language code
   * @param {string} method - Method name from plugin manifest
   * @param {string} endpoint - API endpoint URL
   * @param {string} apiKey - Remote API key
   * @param {number} batchNum - Batch number for logging
   * @param {string|null} [textFormat] - 'markdown' for content-body pieces
   * @returns {object|null} Map of key → translated value
   */
  async _translateBatchWithRetry(keysPayload, sourceLocale, targetLocale, method, endpoint, apiKey, batchNum, textFormat = null, instructions = null) {
    const keyCount = Object.keys(keysPayload).length;
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'champollion',
    };
    const body = {
      source_locale: sourceLocale,
      target_locale: targetLocale,
      method,
      keys: keysPayload,
      ...(textFormat ? { text_format: textFormat } : {}),
      ...(instructions ? { instructions } : {}),
    };
    // `sync --dry --show-prompt`: hand over the exact request, send nothing.
    if (captureRequest({ url: endpoint, headers, body })) return null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle rate limiting with retry
        if (response.status === 429) {
          if (attempt < MAX_RETRIES) {
            // Respect Retry-After header if present
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : getBackoffDelay(attempt);
            output.warn(`⏳ API batch ${batchNum}: Rate limited — retrying in ${Math.round(delay / 1000)}s...`);
            await sleep(delay);
            continue;
          }
          output.error(`API batch ${batchNum}: Rate limited after ${MAX_RETRIES + 1} attempts`);
          return null;
        }

        // Handle server errors with retry
        if (response.status >= 500) {
          if (attempt < MAX_RETRIES) {
            const delay = getBackoffDelay(attempt);
            output.warn(`⏳ API batch ${batchNum}: ${response.status} — retrying in ${Math.round(delay / 1000)}s...`);
            await sleep(delay);
            continue;
          }
          output.error(`API batch ${batchNum}: ${response.status} after ${MAX_RETRIES + 1} attempts`);
          return null;
        }

        // Handle auth errors (no retry)
        if (response.status === 401) {
          const body = await response.json().catch(() => ({}));
          output.error(`API method: Unauthorized — ${body.error?.message || 'Invalid API key'}`);
          output.error('Check your CHAMPOLLION_API_KEY environment variable.');
          return null;
        }

        // Handle payment required (no retry)
        if (response.status === 402) {
          const body = await response.json().catch(() => ({}));
          output.error(`API method: ${body.error?.message || 'Payment required — usage limit exceeded.'}`);
          return null;
        }

        // Handle method not found (no retry)
        if (response.status === 404) {
          const body = await response.json().catch(() => ({}));
          output.error(`API method: Method "${method}" not found — ${body.error?.message || 'Unknown method'}`);
          return null;
        }

        // Handle other client errors (no retry)
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          output.error(`API batch ${batchNum}: ${response.status} — ${body.error?.message || 'Unknown error'}`);
          return null;
        }

        const json = await response.json();

        // Handle partial success (207)
        if (response.status === 207 && json.errors) {
          const errorCount = Object.keys(json.errors).length;
          output.warn(`API batch ${batchNum}: ${errorCount} key(s) failed`);
          for (const [key, err] of Object.entries(json.errors)) {
            output.warn(`${key}: ${err.message}`);
          }
        }

        if (!json.translations || typeof json.translations !== 'object') {
          output.error(`API batch ${batchNum}: Invalid response — no translations object`);
          return null;
        }

        const translatedCount = Object.keys(json.translations).length;
        const costStr = json.meta?.cost_usd ? ` $${json.meta.cost_usd.toFixed(4)}` : '';
        output.info(`✓ API batch ${batchNum} (${translatedCount}/${keyCount} keys${costStr})`);

        return json.translations;

      } catch (err) {
        if (err.name === 'AbortError') {
          if (attempt < MAX_RETRIES) {
            output.warn(`⏳ API batch ${batchNum}: Timeout — retrying...`);
            continue;
          }
          output.error(`API batch ${batchNum}: Timeout after ${MAX_RETRIES + 1} attempts`);
          return null;
        }

        if (attempt < MAX_RETRIES) {
          const delay = getBackoffDelay(attempt);
          output.warn(`⏳ API batch ${batchNum}: ${err.message} — retrying in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
        } else {
          output.error(`API batch ${batchNum}: ${err.message} after ${MAX_RETRIES + 1} attempts`);
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Cost estimation — API method pricing is determined by the remote server.
   * We cannot estimate cost without querying the endpoint.
   */
  estimateCost(keyCount, pairConfig = {}) {
    // An endpoint on this machine (nmt-forge serve, champollion serve on
    // 127.0.0.1) has no API bill — say $0, and why. Anything else is priced
    // by its server: unknown here, never $0.
    const endpoint = pairConfig?.endpoint || this.endpoint;
    if (isLoopbackEndpoint(endpoint)) return localMachineCost(endpoint);
    return {
      estimatedCost: null,
      currency: 'USD',
      source: 'server-determined',
      note: 'Cost is determined by the remote API. Contact the provider for pricing.',
    };
  }

  getQualityTier() {
    return this.qualityTier;
  }

  getProvenance() {
    if (this.pluginProvenance) {
      return this.pluginProvenance;
    }
    return {
      resources: [
        { name: 'Remote Translation API', license: 'Provider ToS', type: 'api' },
      ],
      commercialReady: true,
      flags: [],
    };
  }
}


const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * The bearer token for an `api` endpoint — and ONLY a token meant for it.
 *
 *   1. the pair's own "apiKey": "${VAR}" (read from the environment or
 *      .env.local/.env), or a literal value;
 *   2. CHAMPOLLION_API_KEY;
 *   3. for a loopback endpoint (nmt-forge serve, champollion serve) with no
 *      token configured, a placeholder: those servers need none.
 *
 * It used to fall back to `options.apiKey` — the generic provider key sync
 * resolves for the llm method — so a user's OPENROUTER_API_KEY was sent as
 * the Bearer token to whatever endpoint a pair named (found 2026-10-03). The
 * documented per-pair "apiKey" was never read at all.
 *
 * @returns {string|null}
 */
function resolveApiMethodKey(pairConfig, endpoint, cwd) {
  const own = pairConfig && typeof pairConfig.apiKey === 'string' ? pairConfig.apiKey.trim() : '';
  if (own) {
    const ref = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(own);
    if (!ref) return own;
    const v = getEnvOrFileVar(ref[1], cwd);
    if (v) return v;
  }
  const shared = getEnvOrFileVar('CHAMPOLLION_API_KEY', cwd);
  if (shared) return shared;
  let host = '';
  try { host = new URL(endpoint).hostname; } catch { /* no endpoint */ }
  return LOOPBACK.has(host) ? 'local-no-token' : null;
}

export { APIMethod, resolveApiMethodKey };
