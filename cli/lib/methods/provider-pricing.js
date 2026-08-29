/**
 * Provider API Pricing — Static rates for non-LLM translation APIs.
 *
 * WHY STATIC: Unlike OpenRouter (which exposes /api/v1/models with live
 * per-token pricing), Google, DeepL, and Microsoft do not have pricing
 * APIs. These rates must be hardcoded and manually verified.
 *
 * WHY THIS MODULE: Four method files each had their own hardcoded rate.
 * DeepL was wrong ($20 instead of $25). Single source of truth prevents
 * that class of bug.
 *
 * LAST VERIFIED: 2026-06-08
 * Sources:
 *   Google Cloud Translation v2: https://cloud.google.com/translate/pricing
 *   DeepL API Pro:               https://www.deepl.com/pro-api
 *   Microsoft Translator S1:     https://azure.microsoft.com/pricing/details/cognitive-services/translator/
 */

import {
  EST_CHARS_PER_KEY,
  EST_INPUT_TOKENS_PER_KEY,
  EST_OUTPUT_TOKENS_PER_KEY,
} from '../config.js';
import { fetchModelPricing } from './openrouter-pricing.js';

/**
 * Per-provider pricing data.
 *
 * Each entry has:
 *   costPerMillionChars — USD cost per 1M characters translated
 *   source — pricing page identifier (for LAST VERIFIED audit trail)
 *   note — human-readable pricing context
 */
export const PROVIDER_RATES = {
  'google-translate': {
    costPerMillionChars: 20,
    source: 'google-cloud-pricing',
    note: 'Google Cloud Translation API v2 ($20/1M chars).',
  },
  'deepl': {
    costPerMillionChars: 25,
    source: 'deepl-api-pro-pricing',
    note: 'DeepL API Pro (~$25/1M chars). Free tier: 500K chars/month cap.',
  },
  'microsoft-translator': {
    costPerMillionChars: 10,
    source: 'microsoft-translator-pricing',
    note: 'Azure Translator S1 ($10/1M chars). 2M chars/month free tier.',
  },
  'libretranslate': {
    costPerMillionChars: 0,
    source: 'libretranslate-self-hosted',
    note: 'Self-hosted, free. Infrastructure costs not included.',
  },
};

/**
 * Per-token pricing for the DIRECT LLM providers (anthropic / openai / gemini),
 * in USD per 1M tokens, keyed by EXACT model ID.
 *
 * WHY EXACT IDS, NOT SUBSTRINGS: each provider file used to guess by substring
 * (`model.includes('opus')` → $15/$75). That silently mispriced two ways —
 * an unrecognized model got the default tier's rate as though it were known,
 * and a recognized-but-repriced model kept a rate that no longer existed.
 * Anthropic's `opus` branch was still charging Claude 3 Opus rates ($15/$75)
 * for an Opus generation that costs $5/$25 — a 3x overestimate presented to
 * the user as fact. An exact-ID table cannot drift that way: a model is either
 * priced from a verified row, or reported as UNKNOWN.
 *
 * LIVE DRAW (2026-08-01): none of these three providers expose a pricing API,
 * but OpenRouter publishes /api/v1/models with live per-token pricing for all
 * of them, and every model in the table below maps onto an OpenRouter id by a
 * mechanical rule (see toOpenRouterId). So the rates are now drawn live and
 * the table below is the OFFLINE FALLBACK, not the primary source.
 *
 * That change was not cosmetic. On the day it was made, three pinned rows
 * disagreed with the live figures — and one disagreed in the direction that
 * costs money:
 *
 *     gemini-2.5-flash   pinned $0.15/$0.60   live $0.30/$2.50
 *
 * A 4x UNDER-estimate on output. Under `--max-cost` an under-estimate is the
 * dangerous kind: it lets a run pass a cap it should have failed. (The other
 * two, claude-sonnet-5 and gpt-4o, were over-estimates.) A dated static table
 * is only as good as the last time somebody remembered to date it, and the two
 * blocks that were wrong are exactly the two marked "unverified".
 *
 * HONESTY ABOUT THE SOURCE: OpenRouter's number is what OPENROUTER charges to
 * serve that model. A direct-provider call bills you at the provider's own list
 * price, so the live figure is a PROXY for list, not an authority on it. It is
 * a good proxy — all eight Anthropic rows below, verified against Anthropic's
 * own pricing page on 2026-07-31, match OpenRouter exactly — but the returned
 * `source` always says which number was used, and a live/pinned divergence is
 * reported rather than silently resolved.
 *
 * Unknown models return null from estimateLlmCost() — "unknown", never a guess
 * and never $0. Consumers already treat a null estimate as over-cap under
 * --max-cost (see cost-report.js), so an unpriced model aborts a capped run
 * rather than silently running up a bill.
 */
export const LLM_RATES = {
  // ── Anthropic ──────────────────────────────────────────────────────
  // LAST VERIFIED: 2026-07-31 — https://platform.claude.com/docs/en/pricing
  // Opus 4.6/4.7/4.8 and Opus 5 are all $5/$25; the $15/$75 this table
  // replaces was Claude 3 Opus, retired 2026-01-05.
  'claude-opus-5':     { provider: 'anthropic', input: 5.00,  output: 25.00, verified: '2026-07-31' },
  'claude-opus-4-8':   { provider: 'anthropic', input: 5.00,  output: 25.00, verified: '2026-07-31' },
  'claude-opus-4-7':   { provider: 'anthropic', input: 5.00,  output: 25.00, verified: '2026-07-31' },
  'claude-opus-4-6':   { provider: 'anthropic', input: 5.00,  output: 25.00, verified: '2026-07-31' },
  'claude-sonnet-5':   { provider: 'anthropic', input: 2.00,  output: 10.00, verified: '2026-08-01' },
  'claude-sonnet-4-6': { provider: 'anthropic', input: 3.00,  output: 15.00, verified: '2026-07-31' },
  'claude-haiku-4-5':  { provider: 'anthropic', input: 1.00,  output: 5.00,  verified: '2026-07-31' },
  'claude-fable-5':    { provider: 'anthropic', input: 10.00, output: 50.00, verified: '2026-07-31' },

  // ── OpenAI ─────────────────────────────────────────────────────────
  // LAST VERIFIED: 2026-08-01 against the live OpenRouter draw. The values
  // carried over from openai.js were WRONG: gpt-4o was pinned at $5/$15,
  // twice the real input rate. Corrected here.
  'gpt-4o':      { provider: 'openai', input: 2.50, output: 10.00, verified: '2026-08-01' },
  'gpt-4o-mini': { provider: 'openai', input: 0.15, output: 0.60,  verified: '2026-08-01' },

  // ── Google Gemini ──────────────────────────────────────────────────
  // LAST VERIFIED: 2026-08-01 against the live OpenRouter draw. The values
  // carried over from gemini.js were WRONG, and wrong in the dangerous
  // direction: gemini-2.5-flash output was pinned at $0.60/1M against a real
  // $2.50/1M — a 4x UNDER-estimate, which lets a --max-cost run pass a cap it
  // should have failed. Corrected here.
  'gemini-2.5-flash': { provider: 'gemini', input: 0.30, output: 2.50,  verified: '2026-08-01' },
  'gemini-2.5-pro':   { provider: 'gemini', input: 1.25, output: 10.00, verified: '2026-08-01' },
};

/**
 * Map a native provider model id onto its OpenRouter id.
 *
 * The rule is mechanical and was verified against all 337 live OpenRouter
 * models on 2026-08-01: every id in LLM_RATES resolved.
 *
 *   - Anthropic prefixes `anthropic/` and writes the point release with a DOT
 *     where the native API uses a hyphen: claude-sonnet-4-6 → claude-sonnet-4.6.
 *     Single-segment names pass through: claude-opus-5 → claude-opus-5.
 *   - OpenAI prefixes `openai/`, 1:1.
 *   - Google prefixes `google/`, 1:1.
 *
 * @param {string} model native model id
 * @returns {string|null} OpenRouter id, or null if the family is unrecognised
 */
export function toOpenRouterId(model) {
  if (typeof model !== 'string' || !model) return null;
  if (model.startsWith('claude-')) {
    const parts = model.split('-');
    const [major, minor] = parts.slice(-2);
    // …-4-6 is a point release; …-5 is not.
    if (parts.length >= 4 && /^\d+$/.test(major) && /^\d+$/.test(minor)) {
      return `anthropic/${parts.slice(0, -2).join('-')}-${major}.${minor}`;
    }
    return `anthropic/${model}`;
  }
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) {
    return `openai/${model}`;
  }
  if (model.startsWith('gemini-')) return `google/${model}`;
  return null;
}

// Divergence above this fraction between the live draw and the pinned row is
// reported. It means the pinned table has drifted and needs re-verifying —
// silence there is how a 4x under-estimate survived.
const DIVERGENCE_TOLERANCE = 0.10;

// One warning per model per process; a 3,000-key sync should not print 3,000
// identical lines.
const _warnedModels = new Set();

/**
 * Is the live pricing draw disabled?
 *
 * `CHAMPOLLION_PRICING_OFFLINE=1` forces the pinned table. This is not a test
 * hook — the sovereign-node and airgap-sandbox lanes run with no outbound
 * network at all, and a cost estimate must still resolve there rather than
 * hanging on a fetch that cannot complete. It also makes the test suite
 * deterministic and network-free, which is why the suite sets it.
 *
 * @returns {boolean}
 */
export function pricingOffline() {
  return process.env.CHAMPOLLION_PRICING_OFFLINE === '1';
}

/**
 * Estimate the token cost of translating a batch of keys with a direct LLM.
 *
 * Draws live pricing from OpenRouter and falls back to the pinned table when
 * the network is unavailable. Returns null — "unknown", never $0 and never a
 * guess — when neither source prices the model.
 *
 * @param {string} provider - 'anthropic' | 'openai' | 'gemini' (for the note)
 * @param {string} model - EXACT model ID
 * @param {number} keyCount - Number of translation keys in the batch
 * @returns {Promise<{ estimatedCost: number|null, currency: string, source: string, note: string }>}
 */
export async function estimateLlmCost(provider, model, keyCount) {
  const pinned = LLM_RATES[model];
  const pinnedUsable = pinned && pinned.provider === provider;

  // ── live draw ────────────────────────────────────────────────────
  let rate = null;
  let source = null;
  let divergence = '';

  // The OpenRouter namespace must match the provider being billed. Without
  // this, estimateLlmCost('anthropic', 'gpt-4o', …) would happily price the
  // model through openai/gpt-4o — losing the cross-provider guard that the
  // exact-ID table exists to enforce.
  const OR_NAMESPACE = { anthropic: 'anthropic/', openai: 'openai/', gemini: 'google/' };
  const orId = toOpenRouterId(model);
  const namespaceOk = orId && OR_NAMESPACE[provider] && orId.startsWith(OR_NAMESPACE[provider]);
  if (orId && namespaceOk && !pricingOffline()) {
    let live = null;
    try {
      const pricing = await fetchModelPricing();
      live = pricing.get(orId) || null;
    } catch {
      // fetchModelPricing already degrades to an empty Map offline; this
      // catch only guards an unexpected throw. Fall through to pinned.
      live = null;
    }
    if (live && (live.input > 0 || live.output > 0)) {
      // openrouter-pricing.js stores cost PER TOKEN; this module works in
      // dollars per million tokens.
      rate = { input: live.input * 1_000_000, output: live.output * 1_000_000 };
      source = `openrouter-live (proxy for ${provider} list price)`;

      if (pinnedUsable) {
        const drift = (a, b) => (b === 0 ? (a === 0 ? 0 : 1) : Math.abs(a - b) / b);
        const dIn = drift(rate.input, pinned.input);
        const dOut = drift(rate.output, pinned.output);
        if (dIn > DIVERGENCE_TOLERANCE || dOut > DIVERGENCE_TOLERANCE) {
          divergence =
            ` PINNED TABLE HAS DRIFTED: provider-pricing.js says `
            + `$${pinned.input}/$${pinned.output} per 1M, live says `
            + `$${rate.input.toFixed(2)}/$${rate.output.toFixed(2)}. `
            + `Using live. Re-verify the pinned row against the provider's `
            + `pricing page and re-date it.`;
          if (!_warnedModels.has(model)) {
            _warnedModels.add(model);
            console.warn(`⚠ pricing drift for ${model}:${divergence}`);
          }
        }
      }
    }
  }

  // ── offline fallback ─────────────────────────────────────────────
  if (!rate && pinnedUsable) {
    rate = { input: pinned.input, output: pinned.output };
    source = `pinned-table (${pinned.verified ? `verified ${pinned.verified}` : 'UNVERIFIED'}; live draw unavailable)`;
  }

  if (!rate) {
    return {
      estimatedCost: null,
      currency: 'USD',
      source: `${provider}-pricing-unknown`,
      note: `No rate for ${provider} model "${model}" — not on OpenRouter and `
        + `no pinned row. Cost is UNKNOWN (not $0). Add a row to LLM_RATES in `
        + `provider-pricing.js to price it.`,
    };
  }

  const inputTokens = keyCount * EST_INPUT_TOKENS_PER_KEY;
  const outputTokens = keyCount * EST_OUTPUT_TOKENS_PER_KEY;
  const estimatedCost =
    (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;

  return {
    estimatedCost: Math.round(estimatedCost * 10000) / 10000,
    currency: 'USD',
    source,
    note: `Based on ${provider} ${model} pricing `
      + `($${rate.input.toFixed(2)}/1M input, $${rate.output.toFixed(2)}/1M output, `
      + `${source}).${divergence}`,
  };
}

/**
 * Estimate the API cost for translating a batch of keys.
 *
 * @param {string} provider - Provider name matching a PROVIDER_RATES key
 * @param {number} keyCount - Number of translation keys in the batch
 * @returns {{ estimatedCost: number, currency: string, source: string, note: string }}
 * @throws {Error} If provider is not in PROVIDER_RATES — forces new
 *   providers to add pricing data before estimateCost() can be called.
 */
export function estimateProviderCost(provider, keyCount) {
  const rate = PROVIDER_RATES[provider];
  if (!rate) {
    throw new Error(
      `No pricing data for provider "${provider}". ` +
      `Add it to provider-pricing.js before using estimateCost().`
    );
  }
  const estimatedChars = keyCount * EST_CHARS_PER_KEY;
  const costPerChar = rate.costPerMillionChars / 1_000_000;
  return {
    estimatedCost: Math.round(estimatedChars * costPerChar * 10000) / 10000,
    currency: 'USD',
    source: rate.source,
    note: rate.note,
  };
}
