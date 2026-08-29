/**
 * DirectLLMMethod — shared base class for direct LLM provider integrations.
 *
 * WHY THIS EXISTS:
 *   OpenAI, Anthropic, and Gemini methods share ~90% of their logic:
 *     - Constructor with coaching cache
 *     - translate() with coaching loading, system message building, batch loop
 *     - translateContent() with coaching block prepending
 *     - Dictionary hint injection in per-batch user messages
 *     - JSON response parsing + key validation
 *     - Retry loop with exponential backoff
 *
 *   The ONLY things that differ are:
 *     - API endpoint URL + auth header format
 *     - Request body shape (messages, system param, generationConfig)
 *     - Response parsing path (choices[0] vs content[0] vs candidates[0])
 *     - Pricing, provenance, model patterns
 *
 *   This base class implements all shared logic. Subclasses override a small
 *   set of abstract methods to provide provider-specific HTTP details.
 *
 * RUNTIME MODEL VALIDATION:
 *   On first translate() call, the base class fetches the provider's available
 *   model list and validates the configured model against it. This catches:
 *     - Deprecated/retired model names (the exact bug we fixed twice already)
 *     - OpenRouter-format model strings used with direct providers
 *     - Models from the wrong provider (e.g., claude-* on OpenAI)
 *   The model list is cached per-process to avoid repeated API calls.
 *
 * INHERITANCE CHAIN:
 *   TranslationMethod → LLMMethod → DirectLLMMethod → OpenAIMethod
 *                                                    → AnthropicMethod
 *                                                    → GeminiMethod
 */

import path from 'node:path';
import { LLMMethod, buildSystemMessage, buildUserMessage, isUnsafeKey, inferKeyTypes } from './llm.js';
import { loadCoachingData, findDictionaryMatches, buildCoachedSystemMessage, buildContentCoachingBlock, DEFAULT_COACHING_DIR } from './llm-coached.js';
import { getEnvOrFileVar } from '../api-key.js';
import {
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  isRetryable,
  getBackoffDelay,
  sleep,
  stripCodeFences,
} from './http-utils.js';
import { DEFAULT_BATCH_SIZE, DEFAULT_TEMPERATURE, DEFAULT_MAX_RETRIES, DEFAULT_METHOD_CONCURRENCY } from '../config.js';
import { pMap } from '../concurrent.js';
import { output } from '../output.js';
import { recordTranslationError } from './translation-error.js';

// ── Model validation patterns ──────────────────────────────────────
// Used to detect when a model string belongs to the wrong provider.
// These are intentionally broad — we're catching obvious mismatches,
// not building a comprehensive model catalog.
const MODEL_PATTERNS = {
  openai: {
    prefixes: ['gpt-', 'o1', 'o3', 'o4', 'chatgpt-'],
    label: 'OpenAI',
  },
  anthropic: {
    prefixes: ['claude-'],
    label: 'Anthropic',
  },
  gemini: {
    prefixes: ['gemini-'],
    label: 'Google Gemini',
  },
};

/**
 * Per-process cache of available models per provider.
 * Keyed by provider name (e.g., 'openai'), value is a Set of model IDs
 * or null if the fetch failed (so we don't retry on every batch).
 */
const _modelListCache = new Map();

class DirectLLMMethod extends LLMMethod {
  constructor(options = {}) {
    super(options);
    // Coaching data cache — avoids re-reading .champollion/coaching/<locale>.json per batch
    this._coachingCache = new Map();
    // Track whether we've already validated the model for this instance
    this._modelValidated = false;
  }

  // ── Abstract methods — subclasses MUST implement these ──────────

  /**
   * Environment variable name for this provider's API key.
   * @returns {string} e.g., 'OPENAI_API_KEY'
   */
  _getApiKeyEnvVar() {
    throw new Error(`${this.name}._getApiKeyEnvVar() not implemented`);
  }

  /**
   * Options key name for this provider's API key.
   * @returns {string} e.g., 'openaiApiKey'
   */
  _getApiKeyOptionsKey() {
    throw new Error(`${this.name}._getApiKeyOptionsKey() not implemented`);
  }

  /**
   * Default model ID for this provider.
   * @returns {string} e.g., 'gpt-4o'
   */
  _getDefaultModel() {
    throw new Error(`${this.name}._getDefaultModel() not implemented`);
  }

  /**
   * Human-readable provider name for log messages.
   * @returns {string} e.g., 'OpenAI'
   */
  _getProviderLabel() {
    throw new Error(`${this.name}._getProviderLabel() not implemented`);
  }

  /**
   * Build the HTTP request for the provider's chat/generate endpoint.
   *
   * @param {object} params
   * @param {string} params.prompt - User message content
   * @param {string} params.systemMessage - System message (may be null)
   * @param {string} params.apiKey - Provider API key
   * @param {string} params.model - Model ID
   * @param {number} params.temperature - Sampling temperature
   * @param {boolean} params.isJsonMode - Whether to request JSON output
   * @returns {{ url: string, headers: object, body: object }}
   */
  _buildApiRequest(params) {
    throw new Error(`${this.name}._buildApiRequest() not implemented`);
  }

  /**
   * Extract the text content from the provider's API response JSON.
   *
   * @param {object} json - Parsed response JSON
   * @returns {string|null} Extracted text, or null if missing
   */
  _extractResponseText(json) {
    throw new Error(`${this.name}._extractResponseText() not implemented`);
  }

  /**
   * Fetch the list of available model IDs from the provider's API.
   *
   * @param {string} apiKey - Provider API key
   * @returns {Promise<string[]|null>} Array of model IDs, or null on failure
   */
  async _fetchModels(apiKey) {
    // Default: no model listing available. Subclasses override.
    return null;
  }

  // ── Shared implementation ──────────────────────────────────────

  /**
   * Resolve the API key from options, env vars, or .env files.
   * @param {object} options - Caller-provided options
   * @returns {string|null}
   */
  _resolveApiKey(options) {
    const envVar = this._getApiKeyEnvVar();
    const optKey = this._getApiKeyOptionsKey();
    return options[optKey]
      || getEnvOrFileVar(envVar)
      || getEnvOrFileVar(envVar, options.cwd);
  }

  // ── OpenAI-compatible endpoint base (base_url) ──────────────────
  // Mirrors the harness OpenAIProvider/LocalProvider: lets a method point at
  // any OpenAI-compatible server (Ollama, vLLM, LM Studio, Groq, Together).

  /**
   * Default API base (no /chat/completions) for this provider. Override in
   * subclasses (e.g. OpenAI → api.openai.com/v1, Local → Ollama).
   * @returns {string|null}
   */
  _getDefaultApiBase() { return null; }

  /**
   * Env var that overrides the API base. Default OPENAI_API_BASE (shared with
   * the harness). Subclasses may override (e.g. LocalMethod → LOCAL_API_BASE).
   * @returns {string}
   */
  _getApiBaseEnvVar() { return 'OPENAI_API_BASE'; }

  /**
   * Resolve the endpoint base (no /chat/completions). Precedence:
   * options.baseUrl / this.options.baseUrl > env > subclass default.
   * Normalizes a trailing slash and a full .../chat/completions path.
   * @returns {string|null}
   */
  _resolveApiBase(options = {}) {
    const envVar = this._getApiBaseEnvVar();
    const fromEnv = envVar
      ? (getEnvOrFileVar(envVar) || getEnvOrFileVar(envVar, options.cwd))
      : null;
    const base = options.baseUrl
      || (this.options && this.options.baseUrl)
      || fromEnv
      || this._getDefaultApiBase();
    if (!base) return null;
    let b = String(base).replace(/\/+$/, '');
    if (b.endsWith('/chat/completions')) {
      b = b.slice(0, -'/chat/completions'.length);
    }
    return b;
  }

  /**
   * Validate the model string before making API calls.
   *
   * Checks:
   *   1. OpenRouter-format model strings (contain '/') — wrong method
   *   2. Model belongs to a different provider (e.g., claude-* on OpenAI)
   *   3. Model exists in the provider's API (runtime fetch, cached)
   *
   * Logs warnings but does NOT block — the provider API will give
   * the definitive answer. This is a DX aid, not a gate.
   *
   * @param {string} model - Model ID to validate
   * @param {string} apiKey - API key for model list fetch
   */
  async _validateModel(model, apiKey) {
    if (this._modelValidated) return;
    this._modelValidated = true;

    const label = this._getProviderLabel();

    // Check 1: OpenRouter-format model string (contains '/')
    if (model.includes('/')) {
      output.warn(`${label}: model "${model}" looks like an OpenRouter path.`);
      output.warn(`Direct providers use bare model names (e.g., "${this._getDefaultModel()}").`);
      output.warn(`To use OpenRouter models, set method to 'llm' instead.`);
      return;
    }

    // Check 2: Model belongs to a different provider
    for (const [provider, { prefixes, label: providerLabel }] of Object.entries(MODEL_PATTERNS)) {
      if (provider === this.name) continue; // skip own provider
      const matchesOther = prefixes.some(p => model.startsWith(p));
      if (matchesOther) {
        const article = /^[aeiou]/i.test(providerLabel) ? 'an' : 'a';
        output.warn(`${label}: model "${model}" is ${article} ${providerLabel} model.`);
        output.warn(`This provider (${this.name}) cannot serve ${providerLabel} models.`);
        output.warn(`Use --method ${provider} or set "method": "${provider}" in config.`);
        return;
      }
    }

    // Check 3: Runtime model list validation (cached per-process)
    try {
      let modelSet = _modelListCache.get(this.name);

      // null = already tried and failed; undefined = never tried
      if (modelSet === undefined) {
        const models = await this._fetchModels(apiKey);
        if (models && models.length > 0) {
          modelSet = new Set(models);
          _modelListCache.set(this.name, modelSet);
        } else {
          // Mark as failed so we don't retry on every batch
          _modelListCache.set(this.name, null);
        }
      }

      if (modelSet && !modelSet.has(model)) {
        // Find close matches to suggest
        const suggestions = [...modelSet]
          .filter(m => {
            // Only suggest models that support generateContent-style operations
            // (not embedding models, not vision-only, etc.)
            const base = model.split('-')[0];
            return m.startsWith(base);
          })
          .sort()
          .slice(0, 5);

        output.warn(`${label}: model "${model}" not found in available models.`);
        if (suggestions.length > 0) {
          output.warn(`Similar models: ${suggestions.join(', ')}`);
        }
        output.warn(`The API call will proceed — the provider will give the final verdict.`);
      }
    } catch {
      // Model listing failed silently — don't block translation.
      // The actual translate call will surface any real model errors.
    }
  }

  /**
   * Determine quality tier based on the model name.
   *
   * Provider subclasses can override _getModelTier() for provider-specific
   * mappings. Default: 'standard'.
   */
  getQualityTier(pairConfig = {}) {
    const model = pairConfig.model || this._getDefaultModel();
    return this._getModelTier(model);
  }

  /**
   * Map a model name to a quality tier. Override in subclasses.
   * @param {string} model
   * @returns {'budget'|'standard'|'premium'}
   */
  _getModelTier(model) {
    return 'standard';
  }

  // ── Core translate() — shared across all direct LLM providers ──

  async translate(keys, sourceFlat, pairConfig, options) {
    const apiKey = this._resolveApiKey(options);

    if (!apiKey) {
      output.warn(`${this._getProviderLabel()}: no API key — skipping.`);
      return null;
    }

    const batchSize = pairConfig.batchSize || options.batchSize || DEFAULT_BATCH_SIZE;
    const model = pairConfig.model || options.model || this._getDefaultModel();
    const maxRetries = pairConfig.maxRetries ?? DEFAULT_MAX_RETRIES;
    const langConfig = {
      name: pairConfig.name,
      register: pairConfig.register,
    };

    // Validate model on first call (logs warnings, does not block)
    await this._validateModel(model, apiKey);

    // Load coaching data if available (.champollion/coaching/<locale>.json)
    const cwd = options.cwd || process.cwd();
    const coachingDir = path.join(cwd, DEFAULT_COACHING_DIR);
    const coaching = loadCoachingData(coachingDir, pairConfig.target, this._coachingCache);

    // If coaching data exists, use the coached system message (grammar/style in system
    // prompt for provider-level caching). Otherwise use the standard system message.
    const systemMessage = coaching
      ? buildCoachedSystemMessage(langConfig, coaching)
      : buildSystemMessage(langConfig);
    const allTranslated = {};

    // Wrap the batch function to inject dictionary hints when coaching is active.
    // Thread the resolved temperature so _callProviderBatch doesn't need pairConfig.
    const resolvedTemperature = pairConfig.temperature ?? DEFAULT_TEMPERATURE;
    const descriptions = options.descriptions || null;
    const batchFn = (batch, opts) => this._callProviderBatch(batch, { ...opts, apiKey, model, coaching, temperature: resolvedTemperature, descriptions });

    const batchChunks = [];
    for (let i = 0; i < keys.length; i += batchSize) {
      batchChunks.push(keys.slice(i, i + batchSize));
    }

    await pMap(batchChunks, async (chunk, idx) => {
      const toTranslate = {};
      for (const key of chunk) {
        toTranslate[key] = sourceFlat[key];
      }

      const result = await this._translateWithCascade(toTranslate, langConfig, {
        apiKey,
        model,
        batchNum: idx + 1,
        maxRetries,
        systemMessage,
      }, batchFn);

      if (result) {
        Object.assign(allTranslated, result);
      }
    }, { concurrency: DEFAULT_METHOD_CONCURRENCY });

    return Object.keys(allTranslated).length > 0 ? allTranslated : null;
  }

  // ── Core translateContent() — shared across all direct LLM providers ──

  async translateContent(prompt, pairConfig, options) {
    const apiKey = this._resolveApiKey(options);

    if (!apiKey) {
      output.warn(`${this._getProviderLabel()}: no API key — skipping.`);
      return null;
    }

    const model = pairConfig.model || options.model || this._getDefaultModel();

    // Prepend coaching context (grammar/style rules) to content prompts when available.
    // Dictionary matching is skipped for freeform content — it's too unpredictable.
    const cwd = options.cwd || process.cwd();
    const coachingDir = path.join(cwd, DEFAULT_COACHING_DIR);
    const coaching = loadCoachingData(coachingDir, pairConfig.target, this._coachingCache);
    let augmentedPrompt = prompt;
    if (coaching) {
      const block = buildContentCoachingBlock(coaching);
      if (block) {
        augmentedPrompt = block + '\n\n' + prompt;
      }
    }

    // Round 1: standard timeout (2× base = 60s)
    const result = await this._callProviderDirect({
      prompt: augmentedPrompt,
      apiKey,
      model,
      temperature: pairConfig.temperature ?? DEFAULT_TEMPERATURE,
      timeoutMs: REQUEST_TIMEOUT_MS * 2,
      label: `${this._getProviderLabel()} Content`,
    });

    if (result) return result;

    // Round 2: escalated — longer cool-down and 4× timeout (120s)
    const label = `${this._getProviderLabel()} Content (escalated)`;
    output.warn(`⟳ ${label}: standard retries exhausted — escalating with extended timeout...`);
    await sleep(10_000);

    return this._callProviderDirect({
      prompt: augmentedPrompt,
      apiKey,
      model,
      temperature: pairConfig.temperature ?? DEFAULT_TEMPERATURE,
      timeoutMs: REQUEST_TIMEOUT_MS * 4,
      label,
    });
  }

  // ── Shared batch call — builds user message with coaching hints ──

  async _callProviderBatch(toTranslate, options) {
    const { apiKey, model, batchNum, systemMessage, coaching, temperature } = options;

    // Build user message — inject dictionary term matches when coaching is active.
    // Dictionary hints go in the user message (per-batch) rather than the system
    // message (cached) because they're specific to the current batch's source values.
    let prompt;
    if (coaching && coaching.dictionary) {
      const dictHints = findDictionaryMatches(toTranslate, coaching.dictionary);
      const typeHints = inferKeyTypes(toTranslate);
      let userMessage = '';
      if (dictHints.length > 0) {
        userMessage += 'REQUIRED TERMINOLOGY (use these exact translations):\n';
        userMessage += dictHints.map(h => `  • "${h.term}" → "${h.translation}"`).join('\n');
        userMessage += '\n\n';
      }
      if (typeHints.length > 0) {
        userMessage += `UI context for these keys:\n${typeHints.join('\n')}\n\n`;
      }
      userMessage += JSON.stringify(toTranslate, null, 2);
      prompt = userMessage;
    } else {
      prompt = buildUserMessage(toTranslate, options.descriptions || undefined);
    }

    const label = this._getProviderLabel();
    const content = await this._callProviderDirect({
      prompt,
      systemMessage,
      apiKey,
      model,
      temperature: temperature ?? DEFAULT_TEMPERATURE,
      label: `${label} Batch ${batchNum}`,
      isJsonMode: true,
    });

    if (!content) return null;

    try {
      const parsed = JSON.parse(content);
      const expectedKeys = new Set(Object.keys(toTranslate));
      const validated = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (expectedKeys.has(key) && typeof value === 'string' && !isUnsafeKey(key)) {
          validated[key] = value;
        }
      }
      return Object.keys(validated).length > 0 ? validated : null;
    } catch (err) {
      output.error(`${label} Batch ${batchNum}: JSON parse error — ${err.message}`);
      return { _parseError: true, rawContent: content, error: err.message };
    }
  }

  // ── Shared direct call — retry loop with exponential backoff ──

  async _callProviderDirect({
    prompt,
    systemMessage,
    apiKey,
    model,
    temperature = DEFAULT_TEMPERATURE,
    timeoutMs = REQUEST_TIMEOUT_MS,
    label,
    isJsonMode = false,
  }) {
    label = label || this._getProviderLabel();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const { url, headers, body } = this._buildApiRequest({
          prompt,
          systemMessage,
          apiKey,
          model,
          temperature,
          isJsonMode,
        });

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (isRetryable(response.status)) {
          if (attempt < MAX_RETRIES) {
            const delay = getBackoffDelay(attempt);
            output.warn(`⏳ ${label}: ${response.status} — retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
            await sleep(delay);
            continue;
          }
          output.error(`${label}: ${response.status} after ${MAX_RETRIES + 1} attempts`);
          recordTranslationError(response.status);
          return null;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          output.error(`${label}: API error ${response.status} — ${errorBody}`);
          recordTranslationError(response.status);
          return null;
        }

        const data = await response.json();
        const content = this._extractResponseText(data);
        if (!content) {
          // Empty responses — retry with backoff, same as HTTP errors.
          // Common with long content where the model hits output limits.
          if (attempt < MAX_RETRIES) {
            const delay = getBackoffDelay(attempt);
            output.warn(`⏳ ${label}: empty response — retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
            await sleep(delay);
            continue;
          }
          output.error(`${label}: empty response after ${MAX_RETRIES + 1} attempts`);
          return null;
        }

        return stripCodeFences(content.trim());

      } catch (err) {
        const isTimeout = err.name === 'AbortError';
        const errLabel = isTimeout ? 'timeout' : err.message;

        if (attempt < MAX_RETRIES) {
          const delay = getBackoffDelay(attempt);
          output.warn(`⏳ ${label}: ${errLabel} — retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }

        output.error(`${label} failed: ${errLabel}`);
        return null;
      }
    }
    return null;
  }
}

export {
  DirectLLMMethod,
  MODEL_PATTERNS,
  _modelListCache,
};
