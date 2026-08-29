/**
 * Gemini Translation Method — direct Google Gemini API.
 *
 * Extends DirectLLMMethod to provide Gemini-specific:
 *   - API endpoint (generativelanguage.googleapis.com, key in query string)
 *   - Request body (contents/parts, systemInstruction, responseMimeType)
 *   - Response parsing (candidates[0].content.parts[0].text)
 *   - Model listing via GET /v1beta/models
 *   - Pricing (gemini-2.5-flash, gemini-2.5-pro)
 *
 * All shared logic (translate, translateContent, coaching, retry, validation)
 * lives in DirectLLMMethod.
 */

import { DirectLLMMethod } from './direct-llm.js';
import { fetchAvailableModels } from '../models.js';
import { estimateLlmCost } from './provider-pricing.js';

// The default model, named ONCE — it was previously written twice (here and
// as an inline fallback in estimateCost()) and the two could drift.
const DEFAULT_MODEL = 'gemini-2.5-flash';

class GeminiMethod extends DirectLLMMethod {
  constructor(options = {}) {
    super(options);
    this.name = 'gemini';
  }

  // ── Provider identity ────────────────────────────────────────────

  _getApiKeyEnvVar()     { return 'GEMINI_API_KEY'; }
  _getApiKeyOptionsKey() { return 'geminiApiKey'; }
  _getDefaultModel()     { return DEFAULT_MODEL; }
  _getProviderLabel()    { return 'Gemini'; }

  // ── API request/response shape ───────────────────────────────────

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature, isJsonMode }) {
    // Gemini puts the API key in the query string (not a header).
    // System messages use the separate systemInstruction field.
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
      },
    };

    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage }],
      };
    }

    if (isJsonMode) {
      body.generationConfig.responseMimeType = 'application/json';
    }

    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    };
  }

  _extractResponseText(json) {
    return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  // ── Runtime model listing ────────────────────────────────────────

  async _fetchModels(apiKey) {
    // Delegate to the shared models.js module — single source of truth for
    // model listing used by init wizard, `champollion models`, and validation.
    return fetchAvailableModels('gemini', apiKey);
  }

  // ── Model-aware quality tier ─────────────────────────────────────

  _getModelTier(model) {
    if (model.includes('pro')) return 'premium';
    return 'standard';  // flash
  }

  // ── Pricing ──────────────────────────────────────────────────────

  async estimateCost(keyCount, pairConfig = {}) {
    const estimate = await estimateLlmCost('gemini', pairConfig.model || DEFAULT_MODEL, keyCount);
    // Gemini's free tier can make the real charge lower than the estimate;
    // say so rather than presenting the priced figure as what they'll pay.
    if (estimate.estimatedCost !== null) {
      estimate.note += ' Free tier may apply.';
    }
    return estimate;
  }

  // ── Provenance ───────────────────────────────────────────────────

  checkReadiness(context) {
    // Resolve through the same chain translate() uses (options → env →
    // .env.local/.env in cwd) so readiness can never fail for a key the
    // loader *would* read — e.g. GEMINI_API_KEY set only in .env.local.
    if (!this._resolveApiKey(context || {})) {
      return { ready: false, reason: 'No Gemini API key (GEMINI_API_KEY).' };
    }
    return { ready: true };
  }

  getProvenance() {
    return {
      resources: [
        {
          name: 'Google Gemini API',
          license: 'Proprietary (Google ToS)',
          type: 'api',
        },
      ],
      commercialReady: true,
      flags: [],
    };
  }

  getSetupHelp() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ The Gemini method requires a Google AI API key.                 │',
        '  │                                                                │',
        '  │ 1. Get a key at https://aistudio.google.com/apikey              │',
        '  │ 2. Run: export GEMINI_API_KEY=...                              │',
        '  │ 3. Or add to .env.local: GEMINI_API_KEY=...                    │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return this._apiFailureHelp('Google AI Studio');
  }
}

export { GeminiMethod };
