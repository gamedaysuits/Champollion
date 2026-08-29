/**
 * OpenAI Translation Method — direct OpenAI Chat Completions API.
 *
 * Extends DirectLLMMethod to provide OpenAI-specific:
 *   - API endpoint (https://api.openai.com/v1/chat/completions)
 *   - Auth header format (Bearer token)
 *   - Request body (messages array, response_format for JSON mode)
 *   - Response parsing (choices[0].message.content)
 *   - Model listing via GET /v1/models
 *   - Pricing (gpt-4o, gpt-4o-mini)
 *
 * All shared logic (translate, translateContent, coaching, retry, validation)
 * lives in DirectLLMMethod.
 */

import { DirectLLMMethod } from './direct-llm.js';
import { fetchAvailableModels } from '../models.js';
import { estimateLlmCost } from './provider-pricing.js';

// The default model, named ONCE — it was previously written twice (here and
// as an inline fallback in estimateCost()) and the two could drift.
const DEFAULT_MODEL = 'gpt-4o';

class OpenAIMethod extends DirectLLMMethod {
  constructor(options = {}) {
    super(options);
    this.name = 'openai';
  }

  // ── Provider identity ────────────────────────────────────────────

  _getApiKeyEnvVar()     { return 'OPENAI_API_KEY'; }
  _getApiKeyOptionsKey() { return 'openaiApiKey'; }
  _getDefaultModel()     { return DEFAULT_MODEL; }
  _getProviderLabel()    { return 'OpenAI'; }
  _getDefaultApiBase()   { return 'https://api.openai.com/v1'; }

  // ── API request/response shape ───────────────────────────────────

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature, isJsonMode }) {
    const messages = systemMessage
      ? [{ role: 'system', content: systemMessage }, { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }];

    const body = { model, messages, temperature };
    if (isJsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const base = this._resolveApiBase() || 'https://api.openai.com/v1';
    return {
      url: `${base}/chat/completions`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content || null;
  }

  // ── Runtime model listing ────────────────────────────────────────

  async _fetchModels(apiKey) {
    // Delegate to the shared models.js module — single source of truth for
    // model listing used by init wizard, `champollion models`, and validation.
    return fetchAvailableModels('openai', apiKey);
  }

  // ── Model-aware quality tier ─────────────────────────────────────

  _getModelTier(model) {
    if (model.includes('mini')) return 'budget';
    if (model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) return 'premium';
    return 'standard';  // gpt-4o and similar
  }

  // ── Pricing ──────────────────────────────────────────────────────

  async estimateCost(keyCount, pairConfig = {}) {
    return estimateLlmCost('openai', pairConfig.model || DEFAULT_MODEL, keyCount);
  }

  // ── Provenance ───────────────────────────────────────────────────

  checkReadiness(context) {
    // Resolve through the same chain translate() uses (options → env →
    // .env.local/.env in cwd) so readiness can never fail for a key the
    // loader *would* read — e.g. OPENAI_API_KEY set only in .env.local.
    if (!this._resolveApiKey(context || {})) {
      return { ready: false, reason: 'No OpenAI API key (OPENAI_API_KEY).' };
    }
    return { ready: true };
  }

  getProvenance() {
    return {
      resources: [
        {
          name: 'OpenAI Developer API',
          license: 'Proprietary (OpenAI ToS)',
          type: 'api',
        },
      ],
      commercialReady: true,
      flags: [],
    };
  }

  getSetupHelp() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ The OpenAI method requires an OpenAI API key.                  │',
        '  │                                                                │',
        '  │ 1. Sign up at https://platform.openai.com                      │',
        '  │ 2. Run: export OPENAI_API_KEY=sk-...                           │',
        '  │ 3. Or add to .env.local: OPENAI_API_KEY=sk-...                 │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return this._apiFailureHelp('OpenAI dashboard');
  }
}

export { OpenAIMethod };
