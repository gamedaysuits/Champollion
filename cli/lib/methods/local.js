/**
 * LocalMethod — OpenAI-compatible local / self-hosted endpoint.
 *
 * Mirrors the harness LocalProvider: defaults to Ollama
 * (http://localhost:11434/v1), and works with vLLM, LM Studio, llama.cpp
 * servers, and OpenAI-compatible gateways (Groq, Together) via
 * LOCAL_API_BASE / OPENAI_API_BASE. Inherits all OpenAI-format request/response
 * logic from OpenAIMethod — only the endpoint default, key handling, and cost
 * differ.
 *
 * FAIL-HONEST COST: estimateCost() returns null — local/self-hosted token cost
 * is genuinely unknown to the tool and must never be fabricated as $0.
 */

import { OpenAIMethod } from './openai.js';
import { getEnvOrFileVar } from '../api-key.js';

class LocalMethod extends OpenAIMethod {
  constructor(options = {}) {
    super(options);
    this.name = 'local';
  }

  _getProviderLabel() { return 'Local (OpenAI-compatible)'; }
  _getApiKeyEnvVar()  { return 'OPENAI_API_KEY'; }
  _getDefaultModel()  { return 'llama3.1'; }

  // Endpoint precedence: options.baseUrl > LOCAL_API_BASE > OPENAI_API_BASE >
  // Ollama default. (Matches the harness LocalProvider resolution order.)
  _getApiBaseEnvVar() { return 'LOCAL_API_BASE'; }
  _getDefaultApiBase() {
    return getEnvOrFileVar('OPENAI_API_BASE') || 'http://localhost:11434/v1';
  }

  // Local servers ignore auth — supply a placeholder when no key is set so
  // translate() doesn't skip the run for a "missing" key.
  _resolveApiKey(options) {
    return super._resolveApiKey(options) || 'not-needed';
  }

  checkReadiness(_context) {
    return { ready: true }; // local endpoint; no API key required
  }

  // Cost is genuinely unknown for local/self-hosted models — never $0.
  estimateCost(_keyCount, _pairConfig = {}) {
    return {
      estimatedCost: null,
      currency: 'USD',
      source: 'local-unknown',
      note: 'Local/self-hosted model — token cost unknown (never priced as $0).',
    };
  }

  getProvenance() {
    return {
      resources: [
        { name: 'Local OpenAI-compatible endpoint', license: 'varies', type: 'local' },
      ],
      commercialReady: false,
      flags: ['local-endpoint'],
    };
  }

  getSetupHelp() {
    return [
      '  Local (OpenAI-compatible) endpoint:',
      '   • Ollama: install from https://ollama.com, run `ollama serve`,',
      '     then `ollama pull llama3.1` (default http://localhost:11434/v1).',
      '   • Or point at vLLM / LM Studio / Groq via LOCAL_API_BASE or OPENAI_API_BASE,',
      '     and set the model with --model (e.g. qwen2.5, mistral).',
    ];
  }
}

export { LocalMethod };
