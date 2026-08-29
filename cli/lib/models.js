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

// Per-process cache: provider name → model ID array (or null if fetch failed)
const _modelCache = new Map();

// Lazy-loaded alias map (loaded once from shared/model-aliases.json)
let _aliasCache = null;

/**
 * Load the model alias map from shared/model-aliases.json.
 *
 * Resolves the path relative to the monorepo root (two levels up from cli/lib/).
 * Returns an empty object if the file doesn't exist or fails to parse,
 * so callers can always safely check `aliases[name]`.
 *
 * @returns {Object<string, string>} Short name → full OpenRouter slug
 */
function _loadAliases() {
  if (_aliasCache) return _aliasCache;

  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    // Prefer the package-bundled copy (cli/shared/, shipped via the prepack
    // build-cards-fallback.mjs), then fall back to the monorepo-root SSOT for
    // in-repo dev. Without the package copy, an installed CLI found no alias map
    // and `--model <alias>` silently failed to resolve.
    const aliasPaths = [
      path.resolve(__dirname, '..', 'shared', 'model-aliases.json'),
      path.resolve(__dirname, '..', '..', 'shared', 'model-aliases.json'),
    ];
    let raw = null;
    for (const p of aliasPaths) {
      try { raw = fs.readFileSync(p, 'utf-8'); break; } catch { /* try next */ }
    }
    const parsed = raw ? JSON.parse(raw) : {};
    // Strip metadata keys (e.g., _comment) — only keep actual aliases
    _aliasCache = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!key.startsWith('_') && typeof value === 'string') {
        _aliasCache[key] = value;
      }
    }
  } catch {
    _aliasCache = {};
  }

  return _aliasCache;
}

/**
 * Resolve a model name or alias to a full OpenRouter slug.
 *
 * Resolution order:
 *   1. If contains '/' → already a full slug, pass through
 *   2. Check shared/model-aliases.json for a matching alias
 *   3. Pass through as-is (user may know what they're doing)
 *
 * @param {string} nameOrSlug - User-provided model identifier
 * @returns {string} Full OpenRouter model slug
 */
function resolveModel(nameOrSlug) {
  if (!nameOrSlug || typeof nameOrSlug !== 'string') return nameOrSlug;

  // Already a full slug (contains provider prefix)
  if (nameOrSlug.includes('/')) return nameOrSlug;

  // Check aliases
  const aliases = _loadAliases();
  if (aliases[nameOrSlug]) return aliases[nameOrSlug];

  // Pass through — could be a provider-specific model name (e.g., gemini-2.0-flash)
  return nameOrSlug;
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
    const models = await config.fetch(apiKey);
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
  resolveModel,
  resolveProviderApiKey,
  getProviderLabel,
  isListableProvider,
  getListableProviders,
  clearModelCache,
  PROVIDERS,
};
