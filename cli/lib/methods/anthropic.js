/**
 * Anthropic Translation Method — direct Anthropic Messages API.
 *
 * Extends DirectLLMMethod to provide Anthropic-specific:
 *   - API endpoint (https://api.anthropic.com/v1/messages)
 *   - Auth header format (x-api-key + anthropic-version)
 *   - Request body (messages, system param, temperature)
 *   - Response parsing (content[0].text)
 *   - Model listing via GET /v1/models
 *   - Pricing (claude-sonnet, claude-haiku, claude-opus)
 *
 * All shared logic (translate, translateContent, coaching, retry, validation)
 * lives in DirectLLMMethod.
 */

import { DirectLLMMethod } from './direct-llm.js';
import { fetchAvailableModels } from '../models.js';
import { estimateLlmCost } from './provider-pricing.js';

// The default model, named ONCE. It was previously written twice — in
// _getDefaultModel() and again as an inline `pairConfig.model || '...'`
// fallback in estimateCost() — so the two could drift and price a run
// against a model it did not use.
const DEFAULT_MODEL = 'claude-sonnet-4-6';

class AnthropicMethod extends DirectLLMMethod {
  constructor(options = {}) {
    super(options);
    this.name = 'anthropic';
  }

  // ── Provider identity ────────────────────────────────────────────

  _getApiKeyEnvVar()     { return 'ANTHROPIC_API_KEY'; }
  _getApiKeyOptionsKey() { return 'anthropicApiKey'; }
  _getDefaultModel()     { return DEFAULT_MODEL; }
  _getProviderLabel()    { return 'Anthropic'; }

  // ── API request/response shape ───────────────────────────────────

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    // Anthropic uses a separate 'system' field rather than a system message in
    // the messages array. This is important for prompt caching — the system
    // field is cached independently by Anthropic's infrastructure.
    // Anthropic requires max_tokens as a mandatory parameter.
    // Set generously high — the model stops naturally when done.
    // A low value (e.g., 4096) risks truncating large translation batches.
    const body = {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 16384,
      temperature,
    };

    if (systemMessage) {
      body.system = systemMessage;
    }

    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body,
    };
  }

  _extractResponseText(json) {
    return json.content?.[0]?.text || null;
  }

  // ── Runtime model listing ────────────────────────────────────────

  async _fetchModels(apiKey) {
    // Delegate to the shared models.js module — single source of truth for
    // model listing used by init wizard, `champollion models`, and validation.
    return fetchAvailableModels('anthropic', apiKey);
  }

  // ── Model-aware quality tier ─────────────────────────────────────

  _getModelTier(model) {
    if (model.includes('haiku')) return 'budget';
    if (model.includes('opus')) return 'premium';
    return 'standard';  // sonnet
  }

  // ── Pricing ──────────────────────────────────────────────────────

  async estimateCost(keyCount, pairConfig = {}) {
    return estimateLlmCost('anthropic', pairConfig.model || DEFAULT_MODEL, keyCount);
  }

  // ── Provenance ───────────────────────────────────────────────────

  checkReadiness(context) {
    // Resolve through the same chain translate() uses (options → env →
    // .env.local/.env in cwd) so readiness can never fail for a key the
    // loader *would* read — e.g. ANTHROPIC_API_KEY set only in .env.local.
    if (!this._resolveApiKey(context || {})) {
      return { ready: false, reason: 'No Anthropic API key (ANTHROPIC_API_KEY).' };
    }
    return { ready: true };
  }

  getProvenance() {
    return {
      resources: [
        {
          name: 'Anthropic Messages API',
          license: 'Proprietary (Anthropic ToS)',
          type: 'api',
        },
      ],
      commercialReady: true,
      flags: [],
    };
  }

  getSetupHelp() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ The Anthropic method requires an Anthropic API key.             │',
        '  │                                                                │',
        '  │ 1. Sign up at https://console.anthropic.com                     │',
        '  │ 2. Run: export ANTHROPIC_API_KEY=sk-ant-...                    │',
        '  │ 3. Or add to .env.local: ANTHROPIC_API_KEY=sk-ant-...          │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return this._apiFailureHelp('Anthropic console');
  }
}

export { AnthropicMethod };
