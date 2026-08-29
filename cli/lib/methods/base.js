/**
 * TranslationMethod — base interface for all translation methods.
 *
 * WHY: champollion v2 hardcoded a single OpenRouter fetch in translate.js.
 * v3 abstracts this into a pluggable method system so that different
 * language pairs can use different translation strategies:
 *
 *   - llm:          Direct LLM prompt (current behavior, cheapest)
 *   - llm-coached:  LLM + grammar/dictionary injection (better for complex morphology)
 *   - fst-gated:    (planned) LLM + deterministic morphological gate
 *   - human-review: (planned) LLM draft flagged for human review
 *
 * Each method must implement:
 *   - translate(keys, sourceFlat, pairConfig, options) → { key: value } or null
 *   - estimateCost(keyCount) → { estimatedCost: number|null, currency, source }
 *   - getQualityTier() → 'standard' | 'high' | 'research' | 'verified'
 *   - getProvenance() → { resources: [], commercialReady: boolean, flags: [] }
 *
 * HOW IT WORKS:
 *   The translate orchestrator in translate.js looks up the method name
 *   from the pair config, instantiates the corresponding method class,
 *   and delegates the translation call. The method handles prompting,
 *   API communication, and any post-processing specific to its strategy.
 */

import { getLastTranslationError } from './translation-error.js';

/**
 * Base class for translation methods.
 * Subclasses must override translate() at minimum.
 */
class TranslationMethod {
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
  }

  /**
   * Translate a set of key-value pairs.
   *
   * @param {string[]} keys - Flat dot-notation keys to translate
   * @param {object} sourceFlat - Full flattened source locale (for value lookup)
   * @param {import('../types.js').PairConfig} pairConfig - Pair config from pairs.js (method, model, register, etc.)
   * @param {object} options - { apiKey, batchSize, ... }
   * @param {function} [options.onProgress] - Optional callback fired after each batch chunk: onProgress(completedKeys, totalKeys). Used by sync.js to drive the CLI progress bar.
   * @returns {object|null} Map of key → translated value, or null if all batches failed
   */
  async translate(keys, sourceFlat, pairConfig, options) {
    throw new Error(`TranslationMethod.translate() not implemented by ${this.name}`);
  }

  /**
   * Translate freeform text content (e.g., Markdown body).
   *
   * Not all methods support this — freeform content is harder to gate
   * deterministically. Methods that don't support it should return null,
   * and the orchestrator will fall back to the default LLM method.
   *
   * @param {string} prompt - Complete translation prompt
   * @param {import('../types.js').PairConfig} pairConfig - Pair config
   * @param {object} options - { apiKey, model }
   * @returns {string|null} Translated text, or null if unsupported
   */
  async translateContent(prompt, pairConfig, options) {
    // Default: unsupported. Subclasses override if they can handle freeform.
    return null;
  }

  /**
   * Estimate the cost of translating N keys with this method.
   *
   * Subclasses should override with real pricing data.
   * Returning `estimatedCost: null` means "unknown" — consumers must
   * distinguish this from zero (which would mean "free").
   *
   * @param {number} keyCount - Number of keys to translate
   * @param {import('../types.js').PairConfig} [pairConfig] - Pair config (method, model, etc.) for model-specific pricing
   * @returns {Promise<{ estimatedCost: number|null, currency: string, source: string }>|{ estimatedCost: number|null, currency: string, source: string }}
   */
  estimateCost(keyCount, pairConfig) {
    return { estimatedCost: null, currency: 'USD', source: 'none' };
  }

  /**
   * Get the quality tier for this method.
   *
   * @deprecated Use plugin benchmarks instead of tier labels.
   *   Tier labels are subjective; benchmarks are measurable.
   *   Kept for backward compat — nothing makes dispatch decisions based on this.
   *
   * @returns {string} One of: 'standard', 'high', 'research', 'verified'
   */
  getQualityTier() {
    return 'standard';
  }

  /**
   * Get provenance information for this method.
   *
   * Lists all external resources (datasets, tools, APIs) that this method
   * depends on, their licenses, and whether commercial use is cleared.
   *
   * @returns {{ resources: Array, commercialReady: boolean, flags: string[] }}
   */
  getProvenance() {
    return {
      resources: [],
      commercialReady: true,
      flags: [],
    };
  }

  /**
   * Preflight readiness check — can this method execute right now?
   *
   * Called by resolveRuntime() BEFORE entering the translation loop.
   * If any pair's method returns { ready: false }, the CLI aborts with
   * actionable guidance instead of silently producing garbage output.
   *
   * WHY: Without this, a missing API key was only discovered deep inside
   * the translation loop. For JSON sync, the method returned null and
   * sync.js caught it. But for content sync, the code checked `if (apiKey)`
   * directly and silently wrote hundreds of [EN] fallback files — making
   * it look like translation succeeded when nothing was translated.
   *
   * Now we check at startup: no gas, no ignition.
   *
   * @param {object} context - Runtime context for the readiness check
   * @param {string|null} context.apiKey - The OpenRouter/primary API key
   * @param {string} context.cwd - Working directory (for .env file lookups)
   * @returns {{ ready: boolean, reason?: string }}
   */
  checkReadiness(context) {
    // Base: always ready. Methods override to check their prerequisites.
    return { ready: true };
  }

  /**
   * Return setup guidance lines when translation fails.
   *
   * ⚠️  MAINTENANCE NOTE FOR FUTURE DEVELOPERS:
   *     Each method's setup help lives in its OWN class, not in sync.js.
   *     This prevents the sync orchestrator from accumulating provider-specific
   *     help text (which was a 125-line if/else chain before this refactor).
   *
   *     When you add a new translation method, override this method in your
   *     subclass with provider-specific setup instructions.
   *
   * @returns {string[]} Array of lines to print to stderr, or empty array
   */
  getSetupHelp() {
    return [`        Check your API key and configuration for method "${this.name}".`];
  }

  /**
   * Build the "key is set but translation failed" help line, tailored to the
   * last-seen HTTP failure so we don't blame billing for a bad key.
   *
   * Subclasses call this from getSetupHelp()'s key-present branch instead of
   * hardcoding a generic "check billing" line. When no failure was recorded
   * (e.g. a unit test, or a non-HTTP failure), it returns the same generic
   * guidance as before so behavior is unchanged for those cases.
   *
   * @param {string} dashboardLabel - Where the user manages quota/billing for
   *   this provider (e.g. 'OpenRouter dashboard', 'Azure Portal').
   * @returns {string[]} One help line, indented to match getSetupHelp output.
   */
  _apiFailureHelp(dashboardLabel) {
    const err = getLastTranslationError();
    const kind = err?.kind;
    if (kind === 'auth') {
      return [`        API key is set but the provider rejected it (HTTP ${err.status}) — the key is invalid, expired, or lacks access. Re-check the key value itself, not your billing.`];
    }
    if (kind === 'quota') {
      return [`        API key is set but the request was rate-limited / over quota (HTTP 429). Check your ${dashboardLabel} for quota/billing, then retry.`];
    }
    if (kind === 'server') {
      return [`        API key is set but the provider returned a server error (HTTP ${err.status}). This is an upstream issue — wait and retry; check the provider status page if it persists.`];
    }
    return [`        API key is set but translation failed. Check your ${dashboardLabel} for quota/billing.`];
  }
}

export { TranslationMethod };
