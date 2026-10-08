/**
 * Model listing service — fetches available models from provider APIs.
 *
 * WHY THIS EXISTS:
 *   The init wizard, `champollion models` command, and method-level validation
 *   all need the same thing: "what models does this provider offer for my
 *   API key?" Previously, each method class had its own _fetchModels()
 *   with duplicated fetch logic. This module centralizes it.
 *
 * DESIGN:
 *   - Each provider entry defines how to call its model list API and
 *     how to filter the results to chat-capable models.
 *   - Results are cached per-process to avoid redundant API calls.
 *   - Returns null on failure (network, invalid key) — callers decide
 *     how to handle (fallback prompt, skip, etc.).
 *
 * PROVIDER API ENDPOINTS:
 *   - Gemini:    GET https://generativelanguage.googleapis.com/v1beta/models?key=...
 *   - OpenAI:    GET https://api.openai.com/v1/models  (Bearer token)
 *   - Anthropic: GET https://api.anthropic.com/v1/models (x-api-key header)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnvOrFileVar } from './api-key.js';
// A cycle (config.js imports this module) that is safe: the default is read
// only inside requireExactModelId, at call time, never while modules load.
import { DEFAULT_OPENROUTER_MODEL } from './config.js';

// Per-process cache: provider name → model ID array (or null if fetch failed)
const _modelCache = new Map();

// Lazy-loaded retired-name table (loaded once from shared/retired-model-aliases.json)
let _retiredCache = null;

/**
 * Where to look up the models a name could mean — said in every refusal.
 * `champollion models` lists a direct provider's own names; OpenRouter's
 * catalogue is its public model list.
 */
const MODEL_LIST_HINT = 'List models: https://openrouter.ai/models (OpenRouter slugs), '
  + 'or champollion models --method <gemini|openai|anthropic> (a direct provider\'s own names).';

/**
 * Load the RETIRED short model names from shared/retired-model-aliases.json.
 *
 * Founder ruling 2026-10-05: "slugs should be specific, NOT ALIASES — for all
 * models, all slugs, no aliasing." These names no longer resolve to anything.
 * The table exists only so a refusal can say which exact slug the old name
 * used to stand for — it is never used to map a name to a model.
 *
 * Prefers the package-bundled copy (cli/shared/, shipped via sync:shared),
 * then the monorepo-root SSOT for in-repo dev. A missing or unreadable table
 * leaves the refusal of floating ids intact and only loses the "used to stand
 * for" hint for a retired name — which then fails as an unknown model at the
 * provider, still never resolved.
 *
 * @returns {Object<string, string>} Retired short name → the slug it stood for
 */
function _loadRetiredAliases() {
  if (_retiredCache) return _retiredCache;
  _retiredCache = Object.create(null);
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(__dirname, '..', 'shared', 'retired-model-aliases.json'),
    path.resolve(__dirname, '..', '..', 'shared', 'retired-model-aliases.json'),
  ];
  for (const p of candidates) {
    let raw;
    try { raw = fs.readFileSync(p, 'utf-8'); } catch { continue; }
    const retired = JSON.parse(raw).retired || {};
    for (const [key, value] of Object.entries(retired)) {
      if (typeof value === 'string') _retiredCache[key] = value;
    }
    break;
  }
  return _retiredCache;
}

/**
 * True for a floating id — one that names whatever model a provider points it
 * at today, so a run could not say which model translated: OpenRouter's
 * "~vendor/…" router ids and any "…-latest" / "…:latest" name.
 *
 * @param {string} id
 * @returns {boolean}
 */
function isFloatingModelId(id) {
  return typeof id === 'string' && (id.trim().startsWith('~') || /[-:]latest$/i.test(id.trim()));
}

/**
 * Check that a configured model is an EXACT model slug, and return it unchanged.
 *
 * Founder ruling 2026-10-05: every model is named by its exact provider slug
 * ("google/gemini-3.5-flash", "anthropic/claude-sonnet-4.6", or a direct
 * provider's own exact name, "gpt-5.5"). Nothing resolves a short name:
 *   - a retired alias ("gemini-flash", "gpt", …) is REFUSED, naming the exact
 *     slug it used to stand for;
 *   - a floating id ("~google/gemini-flash-latest", "…-latest") is REFUSED.
 * Anything else passes through as written — the provider judges whether the
 * model exists (direct providers also check it against their model list).
 *
 * @param {string|null|undefined} id - The model as written
 * @param {{ from?: string|null }} [where] - Where it was set ("from --model")
 * @returns {string|null|undefined} The same id
 * @throws {Error} code CHAMPOLLION_MODEL_ID
 */
function requireExactModelId(id, { from = null } = {}) {
  if (!id || typeof id !== 'string') return id;
  const at = from ? ` (${from})` : '';
  const retired = _loadRetiredAliases();
  if (Object.prototype.hasOwnProperty.call(retired, id)) {
    const err = new Error(
      `"${id}"${at} is not a model id — Champollion takes exact model slugs only, no aliases. `
      + `Did you mean ${retired[id]} (what "${id}" used to stand for)? ${MODEL_LIST_HINT}`);
    err.code = 'CHAMPOLLION_MODEL_ID';
    throw err;
  }
  if (isFloatingModelId(id)) {
    const err = new Error(
      `"${id}"${at} is a floating model id — it names whatever model the provider points it at today, `
      + 'so a run could not say which model translated. Champollion takes exact model slugs only: '
      + `name the model itself (e.g. "${DEFAULT_OPENROUTER_MODEL}", the CLI default). ${MODEL_LIST_HINT}`);
    err.code = 'CHAMPOLLION_MODEL_ID';
    throw err;
  }
  return id;
}

/**
 * Provider configurations — how to fetch and filter models for each provider.
 *
 * Adding a new provider:
 *   1. Add an entry here with fetch + filter functions
 *   2. The method class's _fetchModels() delegates to fetchAvailableModels()
 *   3. The init wizard and `models` command automatically pick it up
 */
const PROVIDERS = {
  gemini: {
    envVar: 'GEMINI_API_KEY',
    label: 'Google Gemini',
    async fetch(apiKey) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (!response.ok) return null;
      const data = await response.json();
      // Only include models that support generateContent (not embeddings-only).
      // Strip the "models/" prefix that Gemini returns.
      return (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
    },
  },

  openai: {
    envVar: 'OPENAI_API_KEY',
    label: 'OpenAI',
    async fetch(apiKey) {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!response.ok) return null;
      const data = await response.json();
      // Filter to chat-capable models — skip embeddings, whisper, dall-e, tts, etc.
      return (data.data || [])
        .map(m => m.id)
        .filter(id =>
          id.startsWith('gpt-') ||
          id.startsWith('o1') ||
          id.startsWith('o3') ||
          id.startsWith('o4') ||
          id.startsWith('chatgpt-')
        );
    },
  },

  anthropic: {
    envVar: 'ANTHROPIC_API_KEY',
    label: 'Anthropic',
    async fetch(apiKey) {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });
      if (!response.ok) return null;
      const data = await response.json();
      return (data.data || []).map(m => m.id);
    },
  },
};

/**
 * Fetch available chat-capable models for a provider.
 *
 * Uses the provider's real API to get the actual model list the user's
 * API key has access to. Results are cached per-process.
 *
 * @param {string} provider - Provider name: 'gemini', 'openai', 'anthropic'
 * @param {string} apiKey - The provider's API key
 * @returns {Promise<string[]|null>} Array of model IDs, or null on failure
 */
async function fetchAvailableModels(provider, apiKey) {
  if (!apiKey) return null;

  const config = PROVIDERS[provider];
  if (!config) return null;

  // Check cache — undefined = never tried, null = tried and failed
  const cached = _modelCache.get(provider);
  if (cached !== undefined) return cached;

  try {
    // Floating ids ("gemini-flash-latest", "chatgpt-4o-latest") are listed by
    // the providers but refused everywhere (requireExactModelId) — never offer
    // one, so neither `champollion models` nor init's picker suggests it.
    const models = (await config.fetch(apiKey))?.filter(id => !isFloatingModelId(id)) ?? null;
    if (models && models.length > 0) {
      _modelCache.set(provider, models);
      return models;
    }
    _modelCache.set(provider, null);
    return null;
  } catch {
    _modelCache.set(provider, null);
    return null;
  }
}

/**
 * Resolve an API key for a provider from environment or .env files.
 *
 * @param {string} provider - Provider name
 * @param {string} [cwd] - Working directory for .env file lookup
 * @returns {string|null} API key or null
 */
function resolveProviderApiKey(provider, cwd) {
  const config = PROVIDERS[provider];
  if (!config) return null;
  return getEnvOrFileVar(config.envVar) || getEnvOrFileVar(config.envVar, cwd);
}

/**
 * Get the display label for a provider.
 *
 * @param {string} provider - Provider name
 * @returns {string} Human-readable label
 */
function getProviderLabel(provider) {
  return PROVIDERS[provider]?.label || provider;
}

/**
 * The environment variable a provider's key is read from (null: unknown).
 *
 * @param {string} provider - Provider name
 * @returns {string|null}
 */
function getProviderEnvVar(provider) {
  return PROVIDERS[provider]?.envVar || null;
}

/**
 * Check if a provider has model listing support.
 *
 * @param {string} provider - Provider name
 * @returns {boolean}
 */
function isListableProvider(provider) {
  return provider in PROVIDERS;
}

/**
 * Get all provider names that support model listing.
 *
 * @returns {string[]}
 */
function getListableProviders() {
  return Object.keys(PROVIDERS);
}

/**
 * Clear the per-process model cache.
 * Primarily for testing — allows re-fetching in a long-running process.
 */
function clearModelCache() {
  _modelCache.clear();
}

export {
  fetchAvailableModels,
  requireExactModelId,
  isFloatingModelId,
  resolveProviderApiKey,
  getProviderLabel,
  getProviderEnvVar,
  isListableProvider,
  getListableProviders,
  clearModelCache,
  PROVIDERS,
};
