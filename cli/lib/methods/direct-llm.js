/**
 * DirectLLMMethod — shared base class for direct LLM provider integrations.
 *
 * WHY THIS EXISTS:
 *   OpenAI, Anthropic, Gemini and Local methods share ~90% of their logic:
 *     - translate() with system message building and the batch loop
 *     - translateContent()
 *     - JSON response parsing + key validation
 *     - Retry loop with exponential backoff
 *
 *   THE PROMPT IS THE `llm` METHOD'S, exactly: promptSettingsFor() +
 *   buildSystemMessage() + buildUserMessage() from llm.js (register, gender
 *   guidance, prompt context, protected terms, coachingFile text, the
 *   project glossary, per-key instructions). These methods used to build a
 *   shorter one of their own — no protected terms, no prompt context, no
 *   gender guidance — so a brand name could be translated through `local`
 *   and kept through `llm` (found 2026-10-03). Structured coaching (grammar
 *   rules, style notes) is the llm-coached method's, on any provider.
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
 *   An OpenRouter-style id ("openai/gpt-5.5") becomes
 *   the provider's own name, or is refused when the provider has none
 *   (resolveModelId — pairs.js applies it when the pair graph is built).
 *   On first translate() call, the base class fetches the provider's available
 *   model list and validates the configured model against it. This catches:
 *     - Deprecated/retired model names (the exact bug we fixed twice already)
 *     - Models from the wrong provider (e.g., claude-* on OpenAI)
 *   The model list is cached per-process to avoid repeated API calls.
 *
 * INHERITANCE CHAIN:
 *   TranslationMethod → LLMMethod → DirectLLMMethod → OpenAIMethod
 *                                                    → AnthropicMethod
 *                                                    → GeminiMethod
 */

import path from 'node:path';
import { LLMMethod, buildSystemMessage, buildUserMessage, promptSettingsFor, isUnsafeKey } from './llm.js';
import { captureRequest, isCapturing, PREVIEW_KEY } from './request-capture.js';
import { projectGlossary } from './coaching-data.js';
import { requireExactModelId } from '../models.js';
import { getEnvOrFileVar, findEnvOrFileVar } from '../api-key.js';
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
 * The vendor segment of the OpenRouter-style ids each direct provider serves
 * under its own names ("google/gemini-2.5-flash" → gemini "gemini-2.5-flash").
 */
const DIRECT_MODEL_VENDORS = {
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'google',
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
    // (this._coachingCache — the coaching-file cache — comes from LLMMethod.)
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
   * Every setting that names the endpoint base, in precedence order.
   * OPENAI_BASE_URL is the OpenAI SDK's own name for OPENAI_API_BASE;
   * people (and agents) reach for it first, and it used to be ignored
   * silently — the request went to api.openai.com and failed with a 401
   * that blamed the key (synthetic app-developer personas, 2026-10-03).
   * @returns {string[]}
   */
  _getApiBaseEnvVars() {
    const envVar = this._getApiBaseEnvVar();
    return envVar === 'OPENAI_API_BASE' ? [envVar, 'OPENAI_BASE_URL'] : (envVar ? [envVar] : []);
  }

  /** How a message names the built-in default endpoint. */
  _getDefaultApiBaseLabel() { return 'the built-in default'; }

  /**
   * Resolve the endpoint base (no /chat/completions). Precedence:
   * options.baseUrl / this.options.baseUrl > env (see _getApiBaseEnvVars) >
   * subclass default. Normalizes a trailing slash and a full
   * .../chat/completions path.
   * @returns {string|null}
   */
  _resolveApiBase(options = {}) {
    return this._resolveApiBaseSource(options).base;
  }

  /**
   * The endpoint base AND the setting it came from, so a failure can say
   * "could not reach http://localhost:8000/v1 (LOCAL_API_BASE in .env)"
   * instead of a bare "fetch failed" (synthetic i18next persona, 2026-10).
   *
   * @param {{ baseUrl?: string, cwd?: string }} [options]
   * @returns {{ base: string|null, from: string|null }}
   */
  _resolveApiBaseSource(options = {}) {
    let base = null;
    let from = null;
    if (options.baseUrl) {
      base = options.baseUrl;
      from = 'the baseUrl option';
    } else if (this.options && this.options.baseUrl) {
      base = this.options.baseUrl;
      from = 'the baseUrl setting';
    } else {
      for (const name of this._getApiBaseEnvVars()) {
        const found = findEnvOrFileVar(name, options.cwd);
        if (found) {
          base = found.value;
          from = found.origin === 'environment' ? name : `${name} in ${path.relative(process.cwd(), found.file) || found.origin}`;
          break;
        }
      }
      if (!base) {
        base = this._getDefaultApiBase();
        from = base ? this._getDefaultApiBaseLabel() : null;
      }
    }
    if (!base) return { base: null, from: null };
    let b = String(base).replace(/\/+$/, '');
    if (b.endsWith('/chat/completions')) {
      b = b.slice(0, -'/chat/completions'.length);
    }
    return { base: b, from };
  }

  /**
   * Where this method sends its requests, for a failure message:
   * "http://127.0.0.1:9/v1 (from LOCAL_API_BASE)". Origin and path only —
   * a query string can carry a key (Gemini). null for a provider whose
   * requests do not go through a configurable base (it has no default one:
   * Anthropic and Gemini call their own fixed URLs).
   * @param {object} [options]
   * @returns {string|null}
   */
  _describeEndpoint(options = {}) {
    if (!this._getDefaultApiBase()) return null;
    let resolved;
    try { resolved = this._resolveApiBaseSource(options); } catch { return null; }
    if (!resolved.base) return null;
    let shown = resolved.base;
    try {
      const u = new URL(resolved.base);
      shown = `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
    } catch { /* not a URL — show it as written */ }
    return resolved.from ? `${shown} (from ${resolved.from})` : shown;
  }

  // ── Model ids: the provider's own names, never an OpenRouter slug ──

  /**
   * The vendor segment of the OpenRouter-style ids ("openai/gpt-4o") this
   * provider serves under its own names. null = no vendor (a local server
   * serves whatever names it was given).
   * @returns {string|null}
   */
  _getModelVendor() { return null; }

  /**
   * An id after the vendor segment, as this provider's API names it.
   * Override where the two differ (Anthropic: dotted versions).
   * @param {string} name
   * @returns {string}
   */
  _nativeModelName(name) { return name; }

  /**
   * True when requests go to the provider's own API, so model ids are its
   * names. False for an OpenAI-compatible gateway or server set through
   * OPENAI_API_BASE / LOCAL_API_BASE (Groq, Together, Ollama…): any id —
   * "meta-llama/Llama-3.3-70B" included — is that server's to judge.
   * @returns {boolean}
   */
  _callsOwnApi(cwd = null) {
    if (this._getModelVendor() === null) return false;
    const def = this._getDefaultApiBase();
    if (!def) return true; // a fixed URL (Anthropic, Gemini)
    try { return this._resolveApiBase(cwd ? { cwd } : {}) === def.replace(/\/+$/, ''); } catch { return true; }
  }

  /**
   * The model id this provider is sent, for a configured model:
   *   - a retired alias ("gpt") or a floating id ("…-latest", "~vendor/…")
   *     is REFUSED first, on every transport (gateway and local included),
   *     naming the exact slug to write — founder ruling 2026-10-05: exact
   *     slugs only, no aliasing (lib/models.js requireExactModelId);
   *   - an OpenRouter-style id of THIS provider's vendor becomes its own
   *     name ("openai/gpt-5.5" → "gpt-5.5", "anthropic/claude-haiku-4.5" →
   *     "claude-haiku-4-5") — mirroring the harness's direct providers;
   *   - an id of another vendor ("google/gemini-2.5-flash" for openai) has
   *     no name here: REFUSED, naming a model this method can run. It used to
   *     be sent as is, with a warning, and every request failed.
   * A gateway or local server (see _callsOwnApi) gets the id as written.
   *
   * @param {string|null} model
   * @param {{ from?: string, cwd?: string }} [where] - Where the id was set, for the refusal
   *   ("from --model", "from the top-level \"model\""); cwd: the project
   *   directory (its .env may point the method at a gateway)
   * @returns {string|null}
   * @throws {Error} code CHAMPOLLION_MODEL_ROUTE when there is no such model here,
   *   code CHAMPOLLION_MODEL_ID for a retired alias or a floating id
   */
  resolveModelId(model, { from = null, cwd = null } = {}) {
    if (!model || typeof model !== 'string') return model;
    requireExactModelId(model, { from });
    if (!this._callsOwnApi(cwd)) return model;
    const vendor = this._getModelVendor();
    const resolved = model;
    const slash = resolved.indexOf('/');
    if (slash < 0) return this._nativeModelName(resolved);
    const idVendor = resolved.slice(0, slash);
    const name = resolved.slice(slash + 1);
    const plainName = /^[A-Za-z0-9._-]+$/.test(name);
    if (idVendor === vendor && plainName) return this._nativeModelName(name);

    const notes = [from].filter(Boolean);
    const what = `"${model}"${notes.length > 0 ? ` (${notes.join(', ')})` : ''}`;
    const servedBy = Object.entries(DIRECT_MODEL_VENDORS).find(([, v]) => v === idVendor)?.[0] || null;
    const label = this._getProviderLabel();
    const ways = [`${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label} model (e.g. --model ${this._getDefaultModel()})`];
    if (servedBy && servedBy !== this.name && plainName) ways.push(`--method ${servedBy} (its name for it: "${name}")`);
    ways.push('--method llm to run it through OpenRouter');
    const err = new Error(
      `model ${what} is an OpenRouter model id — ${this.name} calls ${label} directly, `
      + `which has no model by that name. Use ${ways.slice(0, -1).join(', ')} or ${ways[ways.length - 1]}.`
    );
    err.code = 'CHAMPOLLION_MODEL_ROUTE';
    throw err;
  }

  /**
   * Validate the model string before making API calls.
   *
   * Checks:
   *   1. Model belongs to a different provider (e.g., claude-* on OpenAI)
   *   2. Model exists in the provider's API (runtime fetch, cached)
   * (An OpenRouter-style id never gets here: resolveModelId maps or refuses it.)
   *
   * Logs warnings but does NOT block — the provider API will give
   * the definitive answer. This is a DX aid, not a gate. Skipped for a
   * gateway or local server: its names are its own, and its key must not
   * be sent to the provider's model list.
   *
   * @param {string} model - Model ID to validate
   * @param {string} apiKey - API key for model list fetch
   */
  async _validateModel(model, apiKey, cwd = null) {
    if (this._modelValidated) return;
    this._modelValidated = true;
    if (!this._callsOwnApi(cwd)) return;

    const label = this._getProviderLabel();

    // Check 1: Model belongs to a different provider
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

    // Check 2: Runtime model list validation (cached per-process)
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
    // A request preview needs no key: it is shown, never sent.
    const apiKey = this._resolveApiKey(options) || (isCapturing() ? PREVIEW_KEY : null);

    if (!apiKey) {
      output.warn(`${this._getProviderLabel()}: no API key — skipping.`);
      return null;
    }

    const batchSize = pairConfig.batchSize || options.batchSize || DEFAULT_BATCH_SIZE;
    // This provider's own name for the model (an OpenRouter slug is mapped
    // or refused — pairs.js does the same when the pair graph is built).
    // The project directory (its .env, .env.local): options.cwd, never
    // whatever process.cwd() happens to be (the MCP server runs elsewhere).
    const cwd = options.cwd || null;
    const model = this.resolveModelId(pairConfig.model || options.model || this._getDefaultModel(), { cwd });
    const maxRetries = pairConfig.maxRetries ?? DEFAULT_MAX_RETRIES;
    // The `llm` method's prompt, exactly (llm.js promptSettingsFor): only
    // the transport is this provider's.
    const langConfig = promptSettingsFor(pairConfig);

    // Validate model on first call (logs warnings, does not block). It lists
    // the provider's models over the network — not while showing a request.
    if (!isCapturing()) await this._validateModel(model, apiKey, cwd);

    const systemMessage = buildSystemMessage(langConfig);
    // The project glossary: each batch is told the terms it contains.
    const glossary = projectGlossary(pairConfig, options, this._coachingCache);
    const allTranslated = {};

    // Thread the resolved temperature so _callProviderBatch doesn't need pairConfig.
    const resolvedTemperature = pairConfig.temperature ?? DEFAULT_TEMPERATURE;
    const descriptions = options.descriptions || null;
    const batchFn = (batch, opts) => this._callProviderBatch(batch, { ...opts, apiKey, model, glossary, temperature: resolvedTemperature, descriptions, cwd });

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

    const cwd = options.cwd || null;
    const model = this.resolveModelId(pairConfig.model || options.model || this._getDefaultModel(), { cwd });

    // The content prompt is built by the lane (lib/content.js,
    // lib/segment.js), the same for every method, and sent as is — exactly
    // as `llm` sends it. Coaching (grammar rules, style notes) is
    // llm-coached's: its translateContent prepends it for any provider.

    // Round 1: standard timeout (2× base = 60s)
    const result = await this._callProviderDirect({
      prompt,
      apiKey,
      model,
      temperature: pairConfig.temperature ?? DEFAULT_TEMPERATURE,
      timeoutMs: REQUEST_TIMEOUT_MS * 2,
      label: `${this._getProviderLabel()} Content`,
      cwd,
    });

    if (result) return result;

    // Round 2: escalated — longer cool-down and 4× timeout (120s)
    const label = `${this._getProviderLabel()} Content (escalated)`;
    output.warn(`⟳ ${label}: standard retries exhausted — escalating with extended timeout...`);
    await sleep(10_000);

    return this._callProviderDirect({
      prompt,
      apiKey,
      model,
      temperature: pairConfig.temperature ?? DEFAULT_TEMPERATURE,
      timeoutMs: REQUEST_TIMEOUT_MS * 4,
      label,
      cwd,
    });
  }

  // ── Shared batch call — the `llm` user message, this provider's transport ──

  async _callProviderBatch(toTranslate, options) {
    const { apiKey, model, batchNum, systemMessage, temperature } = options;

    // The user message every LLM method sends (llm.js buildUserMessage):
    // the glossary terms this batch contains, then the per-key instructions
    // (plural forms, ICU categories, gettext context, a gate retry's
    // feedback), then the batch. Glossary hints go here (per batch), not in
    // the cached system message, because they depend on the batch's values.
    const prompt = buildUserMessage(toTranslate, options.descriptions || undefined, options.glossary || null);

    const label = this._getProviderLabel();
    const content = await this._callProviderDirect({
      prompt,
      systemMessage,
      apiKey,
      model,
      temperature: temperature ?? DEFAULT_TEMPERATURE,
      label: `${label} Batch ${batchNum}`,
      isJsonMode: true,
      cwd: options.cwd || null,
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
    cwd = null,
  }) {
    label = label || this._getProviderLabel();

    // `sync --dry --show-prompt`: hand over the exact request, send nothing.
    if (isCapturing()) {
      captureRequest(this._buildApiRequest({ prompt, systemMessage, apiKey, model, temperature, isJsonMode, cwd }));
      return null;
    }

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
          cwd,
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
        // A connection failure is "fetch failed" with the real reason
        // (ECONNREFUSED, ENOTFOUND…) on err.cause.
        const cause = err && err.cause && (err.cause.code || err.cause.message);
        const errLabel = isTimeout ? 'timeout' : `${err.message}${cause && !String(err.message).includes(cause) ? ` (${cause})` : ''}`;

        if (attempt < MAX_RETRIES) {
          const delay = getBackoffDelay(attempt);
          output.warn(`⏳ ${label}: ${errLabel} — retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }

        // Say WHERE it tried, and which setting chose that address.
        const endpoint = this._describeEndpoint(cwd ? { cwd } : {});
        output.error(`${label} failed: ${errLabel}${endpoint ? ` — ${isTimeout ? 'no answer from' : 'could not reach'} ${endpoint}` : ''}`);
        return null;
      }
    }
    return null;
  }
}

export {
  DirectLLMMethod,
  MODEL_PATTERNS,
  DIRECT_MODEL_VENDORS,
  _modelListCache,
};
