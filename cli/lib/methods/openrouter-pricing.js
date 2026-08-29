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

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

// Coached methods inject grammar rules and dictionary matches into the
// prompt — roughly 2.5x the input tokens of a standard prompt.
const COACHED_INPUT_MULTIPLIER = 2.5;

// In-memory cache: fetched once per process
let _pricingCache = null;
let _pricingFetchPromise = null;

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
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: { 'User-Agent': 'champollion' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return new Map();

    const json = await response.json();
    const models = json.data || [];
    const pricing = new Map();

    for (const model of models) {
      if (model.id && model.pricing) {
        pricing.set(model.id, {
          input: parseFloat(model.pricing.prompt) || 0,
          output: parseFloat(model.pricing.completion) || 0,
        });
      }
    }

    return pricing;
  } catch {
    // Offline, timeout, or API issue — return empty map
    // Cost estimation degrades gracefully to "unknown"
    return new Map();
  }
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
    return {
      estimatedCost: null,
      currency: 'USD',
      source: 'unknown',
      note: `Model "${model}" not found in OpenRouter pricing. Cost cannot be estimated.`,
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

  return {
    estimatedCost: Math.round(totalCost * 10000) / 10000,
    currency: 'USD',
    source: `openrouter (${model})`,
    note: `Based on ${model} pricing: $${modelPricing.input}/tok in, $${modelPricing.output}/tok out.`,
  };
}

/**
 * Clear the pricing cache. Useful for testing.
 */
function clearPricingCache() {
  _pricingCache = null;
  _pricingFetchPromise = null;
}

export { fetchModelPricing, estimateOpenRouterCost, clearPricingCache };
