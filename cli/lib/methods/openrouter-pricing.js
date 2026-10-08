/**
 * OpenRouter Pricing — fetch live model pricing for cost estimation.
 *
 * WHY: The LLM and LLM-Coached methods use OpenRouter, which aggregates
 * 100+ models, each with different pricing. We can't hardcode rates.
 * OpenRouter provides a public `/api/v1/models` endpoint with per-token
 * pricing for every model — no auth required.
 *
 * HOW IT WORKS:
 *   1. Fetches the model list from OpenRouter (cached for the process lifetime)
 *   2. Looks up the specific model's input/output pricing
 *   3. Estimates cost based on average tokens per key
 *
 * CACHE: Pricing is fetched once per process and cached in memory.
 * This avoids hammering the API during large multi-pair syncs.
 *
 * FALLBACK: If the fetch fails (offline, rate-limited, etc.), returns
 * null pricing — the cost table will show "unknown" for that method.
 * This never blocks a sync.
 */

import { EST_INPUT_TOKENS_PER_KEY, EST_OUTPUT_TOKENS_PER_KEY } from '../config.js';
import { editDistance } from '../edit-distance.js';

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

// Coached methods inject grammar rules and dictionary matches into the
// prompt — roughly 2.5x the input tokens of a standard prompt.
const COACHED_INPUT_MULTIPLIER = 2.5;

// In-memory cache: fetched once per process
let _pricingCache = null;
let _pricingFetchPromise = null;
// What the last fetch saw, beside the prices: whether the list came at all
// (and why not), and every model id it listed — priced or not — so an
// unpriced estimate can say WHICH it is: a name the list does not have (a
// likely typo), a listed model with no per-token price, or no list at all.
// A mistyped slug used to read exactly like an unpriced model: "unknown (no
// method in this run has published pricing)" (Round 11, Next.js persona).
let _catalog = { fetched: false, why: 'not fetched yet', ids: new Set() };

/**
 * Fetch pricing for all OpenRouter models.
 *
 * Returns a Map of model ID → { input, output } (cost per token in USD).
 * Caches the result for the lifetime of the process.
 *
 * @returns {Promise<Map<string, {input: number, output: number}>>}
 */
async function fetchModelPricing() {
  // Return cached result if available
  if (_pricingCache) return _pricingCache;

  // Deduplicate concurrent fetches — if one is in flight, share the promise
  if (_pricingFetchPromise) return _pricingFetchPromise;

  _pricingFetchPromise = _doFetch();
  try {
    _pricingCache = await _pricingFetchPromise;
    return _pricingCache;
  } finally {
    _pricingFetchPromise = null;
  }
}

async function _doFetch() {
  // The live pricing draw is off (an air-gapped node — the same switch the
  // direct providers' pricing honours, lib/methods/provider-pricing.js
  // pricingOffline): no list, and the estimate says so.
  if (process.env.CHAMPOLLION_PRICING_OFFLINE === '1') {
    _catalog = { fetched: false, why: 'the live price draw is off: CHAMPOLLION_PRICING_OFFLINE=1', ids: new Set() };
    return new Map();
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: { 'User-Agent': 'champollion' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      _catalog = { fetched: false, why: `OpenRouter answered HTTP ${response.status}`, ids: new Set() };
      return new Map();
    }

    const json = await response.json();
    const models = json.data || [];
    const pricing = new Map();
    const ids = new Set();

    for (const model of models) {
      if (!model.id) continue;
      ids.add(model.id);
      if (!model.pricing) continue;
      const input = parseFloat(model.pricing.prompt);
      const output = parseFloat(model.pricing.completion);
      // A router whose price depends on the model it picks lists "-1": no
      // per-token price — never a negative estimate (listed, unpriced).
      if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) continue;
      pricing.set(model.id, { input, output });
    }

    // When the list was read: an estimate says which day's prices it used.
    _catalog = { fetched: true, why: null, ids, fetchedAt: new Date().toISOString() };
    return pricing;
  } catch (err) {
    // Offline, timeout, or API issue — return empty map
    // Cost estimation degrades gracefully to "unknown", and says why.
    _catalog = {
      fetched: false,
      why: err?.name === 'AbortError' ? 'the request timed out' : `the request failed (${err?.message || err})`,
      ids: new Set(),
    };
    return new Map();
  }
}

/**
 * The listed model ids closest to a name the list does not have — a likely
 * typo's intended slug. Cheap: one bounded edit distance per listed id.
 *
 * @param {string} model
 * @param {Iterable<string>} ids
 * @param {number} [n=3]
 * @returns {string[]}
 */
function closestModelIds(model, ids, n = 3) {
  const want = String(model).toLowerCase();
  const max = Math.max(2, Math.floor(want.length / 5));
  const scored = [];
  for (const id of ids) {
    const d = editDistance(id.toLowerCase(), want, max);
    if (d <= max) scored.push([d, id]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  return scored.slice(0, n).map(([, id]) => id);
}

/**
 * Why a model has no price, in one sentence that names it — and the
 * estimate's `source` for that case.
 *
 * @param {string} model
 * @returns {{ source: string, note: string, closest?: string[] }}
 */
function unpricedReason(model) {
  if (!_catalog.fetched) {
    return {
      source: 'openrouter-price-list-unavailable',
      note: `OpenRouter's price list could not be read (${_catalog.why}), so the price of "${model}" is unknown.`,
    };
  }
  if (_catalog.ids.has(model)) {
    return {
      source: 'openrouter-no-price',
      note: `"${model}" is in OpenRouter's model list but has no published per-token price, so its cost cannot be estimated.`,
    };
  }
  const closest = closestModelIds(model, _catalog.ids);
  return {
    source: 'openrouter-not-listed',
    note: `"${model}" is not in OpenRouter's model list — likely a typo in the model name`
      + (closest.length > 0 ? `. Closest listed: ${closest.join(', ')}.` : ' (nothing listed is close to it).'),
    closest,
  };
}

/**
 * Estimate cost for translating N keys with a specific model via OpenRouter.
 *
 * Uses real pricing from the OpenRouter models API when available.
 * Falls back to a rough estimate when the model isn't found.
 *
 * Token estimation uses the shared EST_*_TOKENS_PER_KEY constants from
 * config.js (~200 in / ~30 out — see the rationale there). They are the
 * single source of truth for per-key token heuristics: this module used to
 * hardcode 200/30 while config.js exported 60/10, so estimates disagreed
 * between OpenRouter-routed and direct-provider engines.
 * Coached methods use a 2.5x multiplier on input due to grammar/dictionary injection.
 *
 * @param {number} keyCount - Number of keys to translate
 * @param {string} model - OpenRouter model ID (e.g., 'openai/gpt-4o-mini')
 * @param {object} options
 * @param {boolean} [options.coached=false] - Whether this is a coached method (larger prompts)
 * @returns {Promise<{estimatedCost: number|null, currency: string, source: string, note: string}>}
 */
async function estimateOpenRouterCost(keyCount, model, options = {}) {
  const coached = options.coached || false;
  const pricing = await fetchModelPricing();

  const modelPricing = pricing.get(model);
  if (!modelPricing) {
    // Named, and why: not in the list (a likely typo — with the closest
    // listed slugs), listed with no price, or no list to look in.
    const why = unpricedReason(model);
    return {
      estimatedCost: null,
      currency: 'USD',
      source: why.source,
      note: why.note,
      model,
      ...(why.closest && { closest: why.closest }),
    };
  }

  // Token estimation: amortized system message + per-key payload,
  // from the shared config.js constants (SSOT for all engines).
  const inputTokensPerKey = coached
    ? Math.round(EST_INPUT_TOKENS_PER_KEY * COACHED_INPUT_MULTIPLIER)
    : EST_INPUT_TOKENS_PER_KEY;
  const outputTokensPerKey = EST_OUTPUT_TOKENS_PER_KEY;

  const totalInputTokens = keyCount * inputTokensPerKey;
  const totalOutputTokens = keyCount * outputTokensPerKey;

  const inputCost = totalInputTokens * modelPricing.input;
  const outputCost = totalOutputTokens * modelPricing.output;
  const totalCost = inputCost + outputCost;
  const rate = openRouterRate(model, modelPricing, { input: inputTokensPerKey, output: outputTokensPerKey });

  return {
    estimatedCost: Math.round(totalCost * 10000) / 10000,
    currency: 'USD',
    source: `openrouter (${model})`,
    note: `Based on ${model} pricing: $${formatPerMillion(rate.inputPerMillion)}/1M input tokens, `
      + `$${formatPerMillion(rate.outputPerMillion)}/1M output tokens (OpenRouter's price list, read ${rate.fetchedAt}).`,
    rate,
  };
}

/**
 * The rate an estimate used, said in full: what one million tokens cost in
 * and out, where the figure came from (OpenRouter's public price list) and
 * when it was read, and the tokens per key the estimate assumes. An
 * estimate used to give a figure with none of this (Round 14, Next.js
 * persona) — no way to tell a stale or mistaken price from a real one.
 *
 * @param {string} model - The OpenRouter model id priced
 * @param {{ input: number, output: number }} perToken - USD per token
 * @param {{ input: number, output: number }} tokensPerKey - What the estimate assumes
 * @returns {{ model: string, unit: 'token', inputPerMillion: number, outputPerMillion: number,
 *   tokensPerKey: { input: number, output: number }, from: string, url: string, fetchedAt: string|null }}
 */
function openRouterRate(model, perToken, tokensPerKey) {
  return {
    model,
    unit: 'token',
    inputPerMillion: perMillion(perToken.input),
    outputPerMillion: perMillion(perToken.output),
    tokensPerKey,
    from: 'openrouter-price-list',
    url: OPENROUTER_MODELS_URL,
    fetchedAt: _catalog.fetchedAt || null,
  };
}

/** USD per token → USD per million tokens, without float noise (0.0000003 → 0.3). */
function perMillion(perTokenUsd) {
  return Number((perTokenUsd * 1_000_000).toPrecision(12));
}

/** $ per 1M, as people write it: 0.3 → "0.30", 2.5 → "2.50", 0.075 → "0.075". */
function formatPerMillion(usd) {
  return usd >= 0.01 && Number(usd.toFixed(2)) === usd ? usd.toFixed(2) : String(usd);
}

/**
 * Clear the pricing cache. Useful for testing.
 */
function clearPricingCache() {
  _pricingCache = null;
  _pricingFetchPromise = null;
  _catalog = { fetched: false, why: 'not fetched yet', ids: new Set() };
}

/**
 * When OpenRouter's price list was read in this process (ISO 8601), or
 * null when it was not (offline, failed, never asked).
 *
 * @returns {string|null}
 */
function priceListFetchedAt() {
  return _catalog.fetched ? (_catalog.fetchedAt || null) : null;
}

export {
  fetchModelPricing, estimateOpenRouterCost, clearPricingCache, priceListFetchedAt, formatPerMillion,
  OPENROUTER_MODELS_URL,
};
